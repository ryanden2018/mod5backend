const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').createServer(app);
const Cookies = require('cookies');
const io = require('socket.io')(http);
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
app.use(bodyParser.json())

// models
const User = require('./models/User');
const Room = require('./models/Room');
const UserRoom = require('./models/UserRoom');
const Color = require('./models/Color');
const Furnishing = require('./models/Furnishing');
const FurnishingLock = require('./models/FurnishingLock');
require('./sync');

// secrets
const SECRET = process.env.SECRET;
const COOKIESECRET = process.env.COOKIESECRET;


// socket.io

io.on("connection", function(socket) {
  console.log(socket.request.headers.cookie);
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
  return cookies.get('token', {signed:true});
}

// create account (bcrypt)
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
              }, SECRET,
              { expiresIn: '2h' });
              var cookies = new Cookies(req,res,{keys:[COOKIESECRET]})
              cookies.set('token', token, {signed: true});
              return res.status(200).json({success: "Approved"})
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
  jwt.verify(getToken(req,res),SECRET,
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
app.delete("/api/logout", function(req,res) {
  var cookies = new Cookies(req,res,{keys:[COOKIESECRET]})
  cookies.set('token', "", {signed: true});
  res.json({success:"logged out"});
});

// delete a user
app.delete("/api/users/:username", function(req,res) {
  authorizeUser(req,res,req.params.username,
    () => {
      User.User.findAll({where:{username:req.params.username}})
      .then( users => {
        if(users.length > 0) {
          var user = users[0];
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
function authorizeUser(req,res,username,successCallback) {
  jwt.verify(getToken(req,res),SECRET,
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
app.post("/api/rooms", (req,res) => {
  authorizeUser(req,res,null, async (username) => {
    var id = await getId(username);
    Room.Room.create(req.body.room).then( room => {
      UserRoom.UserRoom.create( {userId: id, roomId: room.id, isOwner: true, confirmed: true} )
      .catch( () => res.status(500).json({error:"could not create association"}) );
      res.json(room) 
    }).catch( () => res.status(500).json({error:"could not create room"}) );
  });
});

// patch room

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
        User.User.findByPk(userRooms.userId)
        .then( user => {
          authorizeUser(req,res,user.username, () => {
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

// get room furnishings (collaborators only)

app.get("/api/rooms/:id/furnishings", (req,res) => {
  authorizeUser(req,res,null,async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll({ where: {roomId: req.params.id, userId: userId}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        Room.Room.findByPk(req.params.id)
        .then( room => {
          room.getFurnishings()
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
            furnishing.update(req.body.furnishing)
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

// LISTEN
http.listen(8000);

