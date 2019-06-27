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
        res.json({failed: "Not logged in"})
      } else {
        res.json({user:results.username})
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
          user.destroy({force:true});
          res.json({success:"operation succeeded"});
        } else {
          res.json({error:"operation failed"});
        }
      }).catch(() => {
        res.json({error:"operation failed"});
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
                    return res.status(401).json({failed: "Unauthorized"})
                  }
                  if(result) {
                    bcrypt.hash( req.body.newPassword, 10, (err,hash) => {
                      if(err) {
                        return res.status(500).json({error:"error creating hash"})
                      } else {
                        return User.User.update({passwordDigest:hash},{where:{id:user.id}})
                        .then( () => res.json({success:"operation completed"}) )
                        .catch( () => res.json({failed:"operation failed"}) );
                      }
                    });
                  } else {
                    return res.status(401).json({failed:'Unauthorized'});
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
        if( username && (username === results.username)) {
          successCallback(results.username);
        } else {
          res.status(401).json({failed: "Unauthorized access"});
        }
      }
    }
  );
}


// API ROUTES

// get rooms
app.get("/api/users/:username/rooms", (req,res) => {
  authorizeUser(req,res,req.params.username, () => {
    User.User.findAll({where:{username:req.params.username}})
    .then( users => {
      if(users.length > 0) {
        var user = users[0];
        user.getRooms().then( rooms => {
          res.json(rooms);
        });
      } else {
        res.json({failed:"operation failed"});
      }
    })
  });
});

// post room
app.post("/api/rooms", (req,res) => {
  authorizeUser(req,res,null, async (username) => {
    var id = await getId(username);
    Room.Room.create(req.body.room).then( room => {
      UserRoom.UserRoom.create( {userId: id, roomId: room.id, isOwner: true} );
      res.json(room) 
    });
  });
});

// patch room

// delete room (owner only)

// get room furnishings (collaborators only)

// post furnishing

// patch furnishing

// delete furnishing

// post UserRoom (=== add collaborator)

app.post("/api/UserRoom", (req,res) => {
  
});

// get colors (no auth)
app.get("/api/colors", (req,res) => {
  Color.Color.findAll()
  .then( colors => {
    res.json(colors);
  });
});

// LISTEN
http.listen(8000);

