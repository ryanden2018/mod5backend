const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const genSecrets = require('../helpers/genSecrets');
const Cookies = require('cookies');

// loginCallback(req,res)
// Log a user into the system
//    req: request, must contain:
//            req.body.username: username of user to log in as
//            req.body.password: password of user to log in as
//    res: response, will be JSON {success:"Approved"} if successful, in which case
//                 JWT cookie will be automatically delivered to the client.
function loginCallback(req,res) {
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
              }, genSecrets.privateKey,
              genSecrets.signOptions);
              var cookies = new Cookies(req,res,{keys:[genSecrets.COOKIESECRET]})
              cookies.set('rmbrAuthToken', token, {maxAge: 7000000,signed: true,httpOnly: true,overwrite: true});
              return res.status(200).json({success:"Approved"});
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
}

module.exports = loginCallback;
