const User = require('../models/User');

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
