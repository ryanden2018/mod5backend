const Cookies = require('cookies');
const genSecrets = require('./genSecrets');

// getToken(req,res)
// Extract authorization token from request
//   req: request including cookie
//   res: response
//
// Returns: the JWT extracted from the cookie
function getToken(req,res) {
  let cookies = new Cookies(req,res,{keys:[genSecrets.COOKIESECRET]});
  let cookieToken = cookies.get('rmbrAuthToken', {signed:true});
  return cookieToken;
}

module.exports = getToken;
