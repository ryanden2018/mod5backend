const User = require('../models/User');

// getId(username)
// get userid from username (async!)
//   username: the username of user to find id of
// 
// returns: the user's id, or undefined if user is not found
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

module.exports = getId;
