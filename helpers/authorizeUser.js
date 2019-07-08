const jwt = require('jsonwebtoken');
const genSecrets = require('./genSecrets');
const getToken = require('./getToken');

// authorizeUser(req,res,username,successCallback)
// check that the user is authorized to access the content
//
//  req: request
//  res: response
//  username: the (authorized) user that the current user is claiming to be
//  successCallback: called if username is null, or if username argument is equal
//                   to the username of the currently user. Either way, a single
//                   arguent is passed to successCallback, which is the username
//                   of the present user.
//
// Note: if username argument is null, we *do* *not* check equality of usernames
//       (in which case authorization must be checked in successCallback)
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
