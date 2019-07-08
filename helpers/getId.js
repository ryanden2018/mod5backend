const User = require('./models/User');

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

module.exports = getId;
