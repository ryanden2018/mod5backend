const User = require('../models/User');

// usernameExistsCallback
// Determine whether or not the username is currently taken
//   req: request, must contain:
//                req.params.username: the username to check
//   res: response will be JSON {status: "user exists"} if user exists, else
//                      will be {status: "user does not exist"}
function usernameExistsCallback(req,res) {
  User.User.findAll({where:{username:req.params.username}})
  .then( users => {
    if(users.length > 0) {
      res.status(200).json({status:"user exists"});
    } else {
      res.status(200).json({status:"user does not exist"});
    }
  }).catch( () => {res.status(500).json({error:"query error"})});
}

module.exports = usernameExistsCallback;
