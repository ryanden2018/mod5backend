const uuid = require('uuid/v4');
const NodeRSA = require('node-rsa');

// keys for signing JWTs
const key = new NodeRSA({b: 2048});
const privateKey = key.exportKey('pkcs1-private');
const publicKey = key.exportKey('pkcs8-public');
const signOptions = {
  expiresIn: "2h",
  algorithm: "RS256"
};
const verifyOptions = {
  expiresIn: "2h",
  algorithm: ["RS256"]
};

const COOKIESECRET = uuid(); // NOT SECURE (just for signing cookies)

module.exports = { COOKIESECRET: COOKIESECRET, publicKey: publicKey, privateKey: privateKey, signOptions: signOptions, verifyOptions: verifyOptions };
