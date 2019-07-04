const Sequelize = require('sequelize');

const sequelize = new Sequelize('DATABASE','postgres','',
  { host: process.env.DATABASE_URL, dialect: 'postgres' });
 

class User extends Sequelize.Model { }
User.init( {
  username: {type: Sequelize.STRING, allowNull: false, unique: true},
  passwordDigest: {type: Sequelize.STRING, allowNull: false}
}, { sequelize, modelName: 'user' } );


module.exports = { User:User }

