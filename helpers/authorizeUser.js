const jwt = require('jsonwebtoken');
const genSecrets = require('./genSecrets');

// check that the user is authorized to access the content
// if username is null, do not check equality of usernames (in which case it should
// be checked in the callback)
function authorizeUser(req,res,username,successCallback) {
  jwt.verify(getToken(req,res),genSecrets.publicKey,genSecrets.verifyOptions,
    (err,results) => {
      if(err) {
        res.status(401).json({failed:"Unauthorized access"});
      } else {
        if( !username || (username === results.username)) {
          successCallback(results.username);
        } else {
          res.status(401).json({failed: "Unauthorized access"});
        }
      }
    }
  );
}

module.exports = authorizeUser;
