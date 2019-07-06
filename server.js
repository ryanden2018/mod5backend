const NodeRSA = require('node-rsa');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').createServer(app);
const Cookies = require('cookies');
const cookie = require('cookie');
const cors = require('cors');
const io = require('socket.io')(http);
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const uuid = require('uuid/v4');

const clientURL = ( process.env.DATABASE_URL ? 'furnitureinmotion.herokuapp.com' : 'localhost:3000' );
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(cors({
  origin: ( process.env.DATABASE_URL ? [`https://${clientURL}`,`http://${clientURL}`] : `http://${clientURL}` ),
  methods: ['GET','POST','PATCH','DELETE','PUT','OPTIONS','HEAD'],
  allowedHeaders: 'Content-Type,Authorization,Content-Length,X-Requested-With,X-Prototype-Version,Origin,Allow,*',
  credentials: true,
  maxAge: 7200000,
  preflightContinue: false
}));

// models
const User = require('./models/User');
const Room = require('./models/Room');
const UserRoom = require('./models/UserRoom');
const Color = require('./models/Color');
const Furnishing = require('./models/Furnishing');
const FurnishingLock = require('./models/FurnishingLock');
require('./sync');

// secrets

const COOKIESECRET = uuid(); // NOT SECURE (just for signing cookies)

const key = new NodeRSA({b: 2048});
const privateKey = key.exportKey('pkcs1-private');
const publicKey = key.exportKey('pkcs8-public');
const signOptions = {
  expiresIn: "2h",
  algorithm: "RS256"
};
const verifyOptions = {
  expiresIn: "2h",
  algorithm: ["RS256"]
};


// socket.io

function verifyAuthCookie(socket,successCallback,failureCallback = () => { }) {
  if(socket && socket.request && socket.request.headers && socket.request.headers.cookie) {
    var cookies = cookie.parse(socket.request.headers.cookie);
    if(cookies.rmbrAuthToken) {
      jwt.verify(cookies.rmbrAuthToken,publicKey, verifyOptions, (err,results) => {
        if(results && !err) {
          successCallback(results.id);
        } else {
          failureCallback();
        }
      });
    } else {
      failureCallback();
    }
  } else {
    failureCallback();
  }
}

io.on("connection", function(socket) {
  // place client in a room, removing them from all other rooms
  // note: client can only join a room they are authorized to be in
  // payload: roomId
  socket.on("join", function(payload) {
    let rooms = Object.keys(socket.rooms);
    rooms.forEach( room => {
      if(room.match(/room \d+/)) {
        socket.leave(room);
      }
    });

    verifyAuthCookie(socket, userId => {
      UserRoom.UserRoom.findAll({where: {userId: userId, roomId: payload.roomId}})
      .then( userRooms => {
        if(userRooms.length > 0) {
          socket.join(`room ${payload.roomId}`);
          socket.emit("joinResponse",`joined room ${payload.roomId}`);
        } else {
          socket.emit("joinResponse","failed");
        }
      }).catch( () => socket.emit("joinResponse","failed") );
    });
  });

  // remove client from a room
  // payload: roomId
  socket.on("leave", function(payload) {
    socket.leave(`room ${payload.roomId}`);
  });

  // user requests a lock on furniture item
  // payload: furnishingId
  socket.on("lockRequest", function(payload) {
    verifyAuthCookie(socket, userId => {
      // release stale locks
      FurnishingLock.FurnishingLock.findAll()
      .then( locks => {
        locks.forEach( lock => {
          if( (new Date())-lock.updatedAt > 2500 ) {
            lock.destroy({force:true});
          }
        });
      }).catch( () => { } )

      // create new lock
      FurnishingLock.FurnishingLock.create({userId:userId,furnishingId:payload.furnishingId})
      .then(() => socket.emit("lockResponse","approved"))
      .catch(() => socket.emit("lockResponse","denied"));
    }, () => {
      socket.emit("lockResponse","denied");
    });
  });

  // user moves mouse while locked onto furniture item (does not persist!)
  socket.on("mouseMoved", function(payload) {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1])
        socket.to(`room ${roomId}`).emit("mouseMoved",payload);
      }
    });
  });

  // user refreshes timestamp on lock
  socket.on("lockRefresh", function(payload) {
    verifyAuthCookie(socket, userId => {
      FurnishingLock.FurnishingLock.findAll({where:{userId:userId}})
      .then( locks => {
        if(locks.length > 0) {
          var lock = locks[0];
          lock.update({refreshes: lock.refreshes+1});
          socket.emit("lockRefreshResponse","approved");
        } else {
          socket.emit("lockRefreshResponse","denied");
        }
      }).catch( () => socket.emit("lockRefreshResponse","denied") );
    });
  });

  // user releases lock on furniture item
  // payload: furnishing (new furnishing properties)
  socket.on("lockRelease", function(payload) {
    verifyAuthCookie(socket, userId => {
      FurnishingLock.FurnishingLock.findAll({ where: {userId: userId} })
      .then( locks => {
        locks.forEach( lock => {
          lock.destroy({force:true}).catch(() => { });
        });
      }).catch( () => { } );
      if(payload && payload.furnishing) {
        let rooms = Object.keys(socket.rooms);
        let roomStr = rooms.find( room => room.match(/room \d+/))
        if(roomStr) {
          let roomId = parseInt(roomStr.split(" ")[1])
          Furnishing.Furnishing.update({...payload.furnishing, roomId: roomId},
            {where: {id:payload.furnishing.id,roomId:roomId} });
          socket.to(`room ${roomId}`).emit("update",payload);
        }
      }
    });
  });

  // user update color of furniture item
  // payload: furnishingId, colorName
  socket.on("updateColor", function(payload) {
    verifyAuthCookie(socket, userId => {
      if(payload && payload.furnishingId && payload.colorName) {
        let rooms = Object.keys(socket.rooms);
        let roomStr = rooms.find( room => room.match(/room \d+/))
        if(roomStr) {
          let roomId = parseInt(roomStr.split(" ")[1])
          FurnishingLock.FurnishingLock.findAll({where:{furnishingId:payload.furnishingId}})
          .then( locks => {
            if(locks.length === 0) {
              Furnishing.Furnishing.update({colorName:payload.colorName},
                {where:{id:payload.furnishingId, roomId:roomId}} );
              socket.to(`room ${roomId}`).emit("colorUpdate",payload);
            }
          })
          .catch( () => {} );
        }
      }
    });
  });

  // room is deleted by the owner, signal other clients
  socket.on("roomDeleted",function() {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1])
        socket.to(`room ${roomId}`).emit("roomDeleted");
      }
    });
  });

  // return client's available rooms to view
  socket.on("getAvailableRooms",function(payload) {
    verifyAuthCookie(socket, userId => {
      User.User.findAll({where:{id:userId}})
      .then( users => {
        if(users.length > 0) {
          var user = users[0];
          user.getRooms().then( rooms => {
            socket.emit("availableRooms",{availableRooms:rooms})
          })
          .catch( () => { } );
        }
      })
      .catch( () => { } );
    });
  });

  // user creates a furniture item (notify other users)
  // payload: furnishing (including roomId and UUID)
  socket.on("createFurnishing", function(payload) {
    verifyAuthCookie(socket, userId => {
      if(payload && payload.furnishing) {
        let rooms = Object.keys(socket.rooms);
        let roomStr = rooms.find( room => room.match(/room \d+/))
        if(roomStr) {
          let roomId = parseInt(roomStr.split(" ")[1])
          Furnishing.Furnishing.create( {...payload.furnishing,roomId:roomId} )
          socket.to(`room ${roomId}`).emit("create",payload);
        }
      }
    });
  });

  // remove client from all rooms
  socket.on("removeFromAllRooms", function(payload) {
    let rooms = Object.keys(socket.rooms);
    rooms.forEach( room => {
      if(room.match(/room \d+/)) {
        socket.leave(room);
      }
    });
  });


  // user deletes a furniture item (notify other users)
  // payload: furnishingId
  socket.on("deleteFurnishing", function(payload) {
    verifyAuthCookie(socket, userId => {
      if(payload && payload.furnishingId) {
        let rooms = Object.keys(socket.rooms);
        let roomStr = rooms.find( room => room.match(/room \d+/))
        if(roomStr) {
          let roomId = parseInt(roomStr.split(" ")[1])
          FurnishingLock.FurnishingLock.findAll({where:{furnishingId:payload.furnishingId}})
          .then( locks => {
            if(locks.length === 0) {
              Furnishing.Furnishing.findAll( { where: { id: payload.furnishingId, roomId: roomId } } )
              .then( furnishings => {
                if(furnishings.length > 0) {
                  let furnishing = furnishings[0];
                  furnishing.destroy({force:true})
                }
              }).catch( () => { } )
              socket.to(`room ${roomId}`).emit("delete",payload);
            }
          })
          .catch( () => { } );
        }
      }
    });
  });
});


// AUTH


// get userid from username (async!)

async function getId(username) {
  var id;
  await ( User.User.findAll({where:{username:username}})
  .then( users => {
    if(users.length > 0) {
      var user = users[0];
      id = user.id;
    }
  }) );

  return id;
}


// extract authorization token from req
function getToken(req,res) {
  var cookies = new Cookies(req,res,{keys:[COOKIESECRET]});
  return cookies.get('rmbrAuthToken', {signed:true});
}

// create account (bcrypt)
// req.body: {username:..., password:...}
app.post('/api/users', function(req,res) {
  bcrypt.hash(req.body.password, 10, function(err,hash) {
    if(err) {
      return res.status(500).json({error:"error creating hash"})
    } else {
      User.User.create({username:req.body.username,
                   passwordDigest: hash})
      .then(
        () => {
          res.status(200).json({success:'New user created'});
        }
      ).catch(
        () => {
          res.status(500).json({error:"error creating user"})
        }
      );
    }
  });
});


// login
// req.body: {username:..., password:...}
app.post('/api/login', function(req,res) {
  User.User.findAll({where:{username:req.body.username}})
  .then(
    users => {
      if(users.length > 0) {
        var user = users[0];
        bcrypt.compare(req.body.password, user.passwordDigest,
          function(err,result) {
            if(err) {
              return res.status(401).json({failed:"Unauthorized"});
            }

            if(result) {
              const token = jwt.sign({
                username: user.username,
                id: user.id
              }, privateKey,
              signOptions);
              var cookies = new Cookies(req,res,{keys:[COOKIESECRET]})
              cookies.set('rmbrAuthToken', token, {maxAge: 7000000,signed: true,httpOnly: true, secure:true,overwrite: true});
              return res.redirect(`http${process.env.DATABASE_URL ? 's' : ''}://${clientURL}`)
            } else {
              res.status(401).json({failed:"Unauthorized"});
            }
        });
      } else {
        return res.status(401).json({failed:"User not found"});
      }
    }
  ).catch( error => {
    res.status(500).json({error: "could not complete request"})
  });
});

// check whether we are logged in
app.get("/api/loggedin", function(req,res) {
  jwt.verify(getToken(req,res),publicKey,verifyOptions,
    (err,results) => {
      if(err) {
        res.json({status: "Not logged in"})
      } else {
        if(results) {
          res.json({status:`Logged in as ${results.username}`})
        } else {
          res.json({status: "Not logged in"})
        }
      }
  });
});

// logout from app
app.delete("/api/login", function(req,res) {
  var cookies = new Cookies(req,res,{keys:[COOKIESECRET]})
  cookies.set('rmbrAuthToken', "", {signed: true,maxAge: 7000000,httpOnly:true,secure:true,overwrite:true});
  res.json({success:"logged out"});
});


// find out if username is taken
app.get("/api/:username/exists",function(req,res) {
  User.User.findAll({where:{username:req.params.username}})
  .then( users => {
    if(users.length > 0) {
      res.status(200).json({status:"user exists"});
    } else {
      res.status(200).json({status:"user does not exist"});
    }
  }).catch( () => {res.status(500).json({error:"query error"})});
});

// delete a user (must be logged in)
app.delete("/api/users/:username", function(req,res) {
  authorizeUser(req,res,req.params.username,
    () => {
      User.User.findAll({where:{username:req.params.username}})
      .then( users => {
        if(users.length > 0) {
          var user = users[0];
          var userId = user.id;

          UserRoom.UserRoom.findAll( { where: { userId:userId, isOwner:true} } )
          .then( userRooms => {
            userRooms.forEach( userRoom => {
              Room.Room.findByPk( userRoom.roomId )
              .then( room => {
                UserRoom.UserRoom.findAll( { where: { roomId: room.id } } )
                .then( otherUserRooms => { 
                  otherUserRooms.forEach( otherUserRoom => otherUserRoom.destory({force:true}) )
                })
                .catch( () => { } )
                Furnishing.Furnishing.findAll( { where: { roomId: room.id } } )
                .then( furnishings => {
                  furnishings.forEach( furnishing => furnishing.destroy({force:true}) )
                }).catch( () => { } );
                room.destroy({force:true});
              }).catch( () => { } );
            });
          }).catch( () => { } );

          UserRoom.UserRoom.findAll( { where: { userId: userId } } )
          .then( userRooms => {
            userRooms.forEach( userRoom => userRoom.destroy({force:true}) );
          })
          .catch( () => { } );

          user.destroy({force:true})
          .then( () => res.status(200).json({success:"operation succeeded"}) )
          .catch( () => res.status(500).json({error:"could not delete user"}) );
        } else {
          res.status(401).json({error:"Unauthorized"});
        }
      }).catch(() => {
        res.status(500).json({error:"Error querying users"});
      })
    }
  );
});

// change user's password
// req.body: {currentPassword: ..., newPassword: ...}
app.patch('/api/users/:username/password',
  (req,res) => {
    User.User.findAll({where:{username:req.params.username}})
    .then(
      users => {
        if(users.length > 0) {
          var user = users[0]
          authorizeUser(req,res,req.params.username,
            () => {
              bcrypt.compare( req.body.currentPassword, user.passwordDigest,
                (err,result) => {
                  if(err) {
                    return res.status(401).json({error: "Unauthorized"})
                  }
                  if(result) {
                    bcrypt.hash( req.body.newPassword, 10, (err,hash) => {
                      if(err) {
                        return res.status(500).json({error:"error creating hash"})
                      } else {
                        return User.User.update({passwordDigest:hash},{where:{id:user.id}})
                        .then( () => res.json({success:"operation completed"}) )
                        .catch( () => res.status(500).json({error:"could not update user"}) );
                      }
                    });
                  } else {
                    return res.status(401).json({error:'Unauthorized'});
                  }
                }
              );
            }
          );
        } else {
          return res.status(401).json({failed:"Unauthorized"});
        }
      }
    ).catch(
      () => {
        return res.status(401).json({failed:"Unauthorized"});
      }
    );
  }
);


// check that the user is authorized to access the content
// if username is null, do not check equality of usernames (in which case it should
// be checked in the callback)
function authorizeUser(req,res,username,successCallback) {
  jwt.verify(getToken(req,res),publicKey,verifyOptions,
    (err,results) => {
      if(err) {
        res.status(401).json({failed:"Unauthorized access"});
      } else {
        if( !username || (username === results.username)) {
          successCallback(results.username);
        } else {
          res.status(401).json({failed: "Unauthorized access"});
        }
      }
    }
  );
}


// API ROUTES

// get rooms for particular user
app.get("/api/users/:username/rooms", (req,res) => {
  authorizeUser(req,res,req.params.username, () => {
    User.User.findAll({where:{username:req.params.username}})
    .then( users => {
      if(users.length > 0) {
        var user = users[0];
        user.getRooms().then( rooms => {
          res.json(rooms);
        })
        .catch( () => res.status(500).json({error: "error finding rooms"}) );
      } else {
        res.status(500).json({error:"error finding user"});
      }
    })
    .catch( () => res.status(500).json({error:"error finding user"}) );
  });
});

// post room
// req.body: {room: {name: ..., length:..., width:..., height:...} }
app.post("/api/rooms", (req,res) => {
  authorizeUser(req,res,null, async (username) => {
    var id = await getId(username);
    Room.Room.create(req.body.room).then( room => {
      UserRoom.UserRoom.create( {userId: id, roomId: room.id, isOwner: true, confirmed: true} )
      .then( () => res.json(room) )
      .catch( () => res.status(500).json({error:"could not create association"}) );
    }).catch( () => res.status(500).json({error:"could not create room"}) );
  });
});

// patch room
// req.body: {room: {...}}
app.patch("/api/rooms/:id", (req,res) => {
  authorizeUser(req,res,null, async (username) => {
    var id = await getId(username);
    Room.Room.findByPk( req.params.id )
    .then( room => {
      room.getUsers({where: {userId: id}})
      .then( users => {
        if(users.length > 0) {
          room.update(req.body.room)
          .then( () => res.json(room) )
          .catch( () => res.status(500).json({error:"could not update room"}) );
        } else {
          res.status(500).json({error:"user not found in room collaborators list"});
        }
      }).catch( () => res.status(500).json({error:"user not found in room collaborators list"}) );
    }).catch( () => res.status(404).json({error:"room not found"}) );
  });
});



// delete room (owner only)

app.delete("/api/rooms/:id", (req,res) => {
  Room.Room.findByPk(req.params.id)
  .then( room => {
    UserRoom.UserRoom.findAll({where: {roomId: room.id, isOwner: true}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        User.User.findByPk(userRooms[0].userId)
        .then( user => {
          authorizeUser(req,res,user.username, () => {
            UserRoom.UserRoom.findAll( { where: { roomId: req.params.id } } )
            .then( otherUserRooms => {
              otherUserRooms.forEach( otherUserRoom => otherUserRoom.destroy({force:true}) );
            }).catch( () => { } );
            Furnishing.Furnishing.findAll( { where: { roomId: req.params.id } } )
            .then( furnishings => {
              furnishings.forEach( furnishing => furnishing.destroy({force:true}) );
            }).catch( () => { } );
            room.destroy({force:true})
            .then( () => res.status(200).json({success: "operation completed"}) )
            .catch( () => res.status(500).json({error:"could not delete room"}) );
          });
        }).catch( () => res.status(500).json({error:"could not get username"}) );
      } else {
        res.status(500).json({error:"could not get association"});
      }
    }).catch( () => res.status(500).json({error:"error getting association"}) );
  }).catch( () => res.status(404).json({error:"room not found"}) );
});

// get room (collaborators only)

app.get("/api/rooms/:id", (req,res) => {
  authorizeUser(req,res,null,async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll({ where: {roomId: req.params.id, userId: userId}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        Room.Room.findByPk(req.params.id)
        .then( room => {
          res.status(200).json(room);
        }).catch( () => res.status(404).json({error:"room not found"}) );
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error:"could not find association"}) );
  });
});

// determine whether user is owner of room

app.get("/api/rooms/:id/isOwner", (req,res) => {
  authorizeUser(req,res,null, async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll({where:{roomId:req.params.id,userId:userId}})
    .then(userRooms => {
      if(userRooms.length > 0) {
        res.status(200).json( {status: userRooms[0].isOwner});
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error:"could not find association"}) );
  });
});

// get room furnishings (collaborators only)

app.get("/api/rooms/:id/furnishings", (req,res) => {
  authorizeUser(req,res,null,async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll({ where: {roomId: req.params.id, userId: userId}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        Room.Room.findByPk(req.params.id)
        .then( () => {
          Furnishing.Furnishing.findAll( { where: { roomId: req.params.id } } )
          .then( furnishings => {
            res.status(200).json( furnishings );
          }).catch( () => res.status(500).json({error:"could not get furnishings"}) );
        }).catch( () => res.status(404).json({error:"room not found"}) );
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error:"could not find association"}) );
  });
});

// post furnishing
// req.body: {furnishing: { type: ..., posx: ..., posy: ..., theta: ..., roomId: ..., color: ... } }
app.post("/api/furnishings", (req,res) => {
  authorizeUser(req,res,null, async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll( { where: { roomId: req.body.furnishing.roomId, userId: userId } } )
    .then( userRooms => {
      if(userRooms.length > 0) {
        Furnishing.Furnishing.create( req.body.furnishing )
        .then( furnishing => res.status(200).json(furnishing) )
        .catch( () => res.status(500).json({error:"could not create furnishing"}) );
      } else {
        res.status(500).json({error: "could not find association"})
      }
    }).catch( () => res.status(500).json({error: "could not find association"}) );
  });
});

// patch furnishing
// req.body: {furnishing: { ... }}
app.patch("/api/furnishings/:id", (req,res) => {
  authorizeUser(req,res,null, (username) => {
    Furnishing.Furnishing.findByPk(req.params.id)
    .then( furnishing => {
      Room.Room.findByPk(furnishing.roomId)
      .then( room => {
        room.getUsers()
        .then( users => {
          var user = users.find(user => user.username === username);
          if(user) {
            furnishing.update({...req.body.furnishing, roomId: room.id})
            .then( furnishing => res.status(200).json(furnishing) )
            .catch( () => res.status(500).json({error:"Could not update furnishing"}) );
          } else {
            res.status(401).json({error:"Unauthorized"});
          }
        }).catch( () => res.status(500).json({error:"error getting users"}) );
      }).catch( () => res.status(500).json({error:"could not get room"}) );
    }).catch( () => res.status(404).json({error:"furnishing not found"}) );
  });
});



// delete furnishing

app.delete("/api/furnishings/:id", (req,res) => {
  authorizeUser(req,res,null, (username) => {
    Furnishing.Furnishing.findByPk(req.params.id)
    .then( furnishing => {
      Room.Room.findByPk(furnishing.roomId)
      .then( room => {
        room.getUsers()
        .then( users => {
          var user = users.find(user => user.username === username);
          if(user) {
            furnishing.destroy({force:true})
            .then( () => res.status(200).json({success:"Operation completed"}) )
            .catch( () => res.status(500).json({error:"Could not delete furnishing"}) );
          } else {
            res.status(401).json({error:"Unauthorized"});
          }
        }).catch( () => res.status(500).json({error:"error getting users"}) );
      }).catch( () => res.status(500).json({error:"could not get room"}) );
    }).catch( () => res.status(404).json({error:"furnishing not found"}) );
  });
});

// post UserRoom (=== add collaborator) ... owner only
// req.body: {recipientUsername: ..., roomId: ...}
app.post("/api/UserRooms", (req,res) => {
  authorizeUser(req,res,null, async (username) => {
    var ownerId = await getId(username);
    var recipientId = await getId(req.body.recipientUsername);
    var roomId = req.body.roomId;
    UserRoom.UserRoom.findAll({ where: { userId: ownerId, roomId: roomId } })
    .then( userRooms => {
      if(userRooms.length > 0) {
        var userRoom = userRooms[0];
        if(userRoom.isOwner) {
          UserRoom.UserRoom.create({ roomId: roomId, userId: recipientId, isOwner: false, confirmed: false })
          .then( () => res.status(200).json({success: "operation complete"}) )
          .catch( () => res.status(500).json({error: "could not create association"}) );
        } else {
          res.status(401).json({error: "Unauthorized"});
        }
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error: "could not find association"}) );
  });
});

// patch UserRoom (=> confirm collaborator)
// body: {roomId: ..., confirmed: ...}
app.patch("/api/UserRooms", (req,res) => {
  authorizeUser( req, res, null, async (username) => {
    var userId = await getId(username);
    var roomId = req.body.roomId;
    UserRoom.UserRoom.findAll({ where: { userId: userId, roomId: roomId } } )
    .then( userRooms => {
      if(userRooms.length > 0) {
        var userRoom = userRooms[0];
        userRoom.update({confirmed: req.body.confirmed})
        .then( () => res.status(200).json({success: "operation completed"}) )
        .catch( () => res.status(500).json({error: "could not update association"}) );
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error: "could not find association"}) );
  });
});

// delete UserRoom (leave room, only if *not* owner)

app.delete("/api/UserRooms", (req,res) => {
  authorizeuser( req,res,null, async (username) => {
    var userId = await getId(username);
    var roomId = req.body.roomId;
    UserRoom.UserRoom.findAll({where: {userId: userId, roomId: roomId, isOwner: false}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        var userRoom = userRooms[0];
        userRoom.destroy({force:true})
        .then( () => res.status(200).json({success: "operation completed"}) )
        .catch( () => res.status(500).json({error:"could not delete association"}) );
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error: "could not find association"}) );
  });
});

// get colors (no auth)
app.get("/api/colors", (req,res) => {
  Color.Color.findAll()
  .then( colors => {
    res.status(200).json(colors);
  })
  .catch( () => res.status(500).json({error:"error getting colors"}) );
});

// get color by name (no auth)
app.get("/api/colors/:colorName", (req,res) => {
  Color.Color.findAll({where:{name:req.params.colorName}})
  .then( colors => {
    if(colors.length > 0) {
      res.status(200).json(colors[0]);
    } else {
      res.status(404).json({error:"color not found"});
    }
  }).catch( () => { 
    res.status(500).json({error:"error getting color"});
  });
});

// LISTEN
http.listen(process.env.PORT || 8000);

