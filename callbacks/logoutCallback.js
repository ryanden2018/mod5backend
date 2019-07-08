const Cookies = require('cookies');
const genSecrets = require('../helpers/genSecrets');

function logoutCallback(req,res) {
  var cookies = new Cookies(req,res,{keys:[genSecrets.COOKIESECRET]})
  cookies.set('rmbrAuthToken', "", {signed: true,maxAge: 7000000,httpOnly:true,overwrite:true});
  res.json({success:"logged out"});
}

module.exports = logoutCallback;
