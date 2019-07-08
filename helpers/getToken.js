const Cookies = require('cookies');
const genSecrets = require('./genSecrets');

// extract authorization token from req
function getToken(req,res) {
  let cookies = new Cookies(req,res,{keys:[genSecrets.COOKIESECRET]});
  let cookieToken = cookies.get('rmbrAuthToken', {signed:true});
  return cookieToken;
}

module.exports = getToken;
