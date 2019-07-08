const User = require('../models/User');
const authorizeUser = require('../helpers/authorizeUser');
const bcrypt = require('bcrypt');

function changePasswordCallback(req,res) {
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

module.exports = changePasswordCallback;
