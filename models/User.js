const Sequelize = require('sequelize');

const sequelize = new Sequelize('roombuilder','postgres','abcdef',
  { host: 'localhost', dialect: 'postgres' });
 

class User extends Sequelize.Model { }
User.init( {
  username: {type: Sequelize.STRING, allowNull: false, unique: true},
  passwordDigest: {type: Sequelize.STRING, allowNull: false}
}, { sequelize, modelName: 'user' } );


module.exports = { User:User }

