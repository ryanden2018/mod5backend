const Cookies = require('cookies');
const genSecrets = require('../helpers/genSecrets');

// logoutCallback(req,res)
// Log out the current user (resets the auth cookie).
//    req: request (containing JWT cookie)
//    res: response, will be JSON {success:"logged out"} upon successful logout
function logoutCallback(req,res) {
  var cookies = new Cookies(req,res,{keys:[genSecrets.COOKIESECRET]})
  cookies.set('rmbrAuthToken', "", {signed: true,maxAge: 7000000,httpOnly:true,overwrite:true});
  res.json({success:"logged out"});
}

module.exports = logoutCallback;
