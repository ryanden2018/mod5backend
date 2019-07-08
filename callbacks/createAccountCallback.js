const bcrypt = require('bcrypt');
const User = require('../models/User');

function createAccountCallback(req,res) {
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
}

module.exports = createAccountCallback;
