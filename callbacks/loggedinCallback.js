const jwt = require('jsonwebtoken');
const getToken = require('../helpers/getToken');
const genSecrets = require('../helpers/genSecrets');

function loggedinCallback(req,res) {
  jwt.verify(getToken(req,res),genSecrets.publicKey,genSecrets.verifyOptions,
    (err,results) => {
      if(err) {
        res.json({status: "Not logged in"})
      } else {
        if(results) {
          res.json({status:`Logged in as ${results.username}`})
        } else {
          res.json({status: "Not logged in"})
        }
      }
  });
}

module.exports = loggedinCallback;
