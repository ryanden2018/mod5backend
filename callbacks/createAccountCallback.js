const bcrypt = require('bcrypt');
const User = require('../models/User');

// createAccountCallback(req,res)
// Create a new user account
//   req: request, must contain:
//                req.body.username: desired username (required to be unique)
//                req.body.password: desired password
//   res: response, will be JSON {success:'New user created'} in case of success
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
