const User = require('./models/User')

const forceSync = true;

User.User.sync({force:forceSync})
.then( () => {
  User.User.create({username:"smith",passwordDigest:"abc"})
  
    User.User.create({username:"smith",passwordDigest:"def"})
    .catch( () => console.log("ERROR CAUGHT") );
  
});


