const Sequelize = require('sequelize');

let sequelize;
if(process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL,
    { dialect: 'postgres', protocol: 'postgres' });
} else {
  sequelize = new Sequelize("postgres://postgres:abcdef@localhost:5432/roombuilder",
    { dialect: 'postgres', protocol: 'postgres' });
}

class User extends Sequelize.Model { }
User.init( {
  username: {type: Sequelize.STRING, allowNull: false, unique: true},
  passwordDigest: {type: Sequelize.STRING, allowNull: false}
}, { sequelize, modelName: 'user' } );


module.exports = { User:User }

