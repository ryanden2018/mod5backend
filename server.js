const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').createServer(app);
const Cookies = require('cookies');
const io = require('socket.io')(http);
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('./models/User')

require('./seed')

const SECRET = process.env.SECRET
const COOKIESECRET = process.env.COOKIESECRET

app.use(bodyParser.json())

// AUTH

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
      User.create({username:req.body.username,
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
  User.findAll({where:{username:req.body.username}})
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

app.patch('/api/users/:username/password',
  (req,res) => {
    User.findAll({where:{username:req.params.username}})
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
                        return User.update({passwordDigest:hash},{where:{id:user.id}})
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


function authorizeUser(req,res,username,successCallback) {
  jwt.verify(getToken(req,res),SECRET,
    (err,results) => {
      if(err) {
        res.status(401).json({failed:"Unauthorized access"});
      } else {
        if(username === results.username) {
          successCallback();
        } else {
          res.status(401).json({failed: "Unauthorized access"});
        }
      }
    }
  );
}


// API ROUTES


// LISTEN


http.listen(8000);

