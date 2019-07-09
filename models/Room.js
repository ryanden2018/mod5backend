const Sequelize = require('sequelize');

let sequelize;
if(process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL,
    { dialect: 'postgres', protocol: 'postgres' });
} else {
  sequelize = new Sequelize("postgres://postgres:abcdef@localhost:5432/roombuilder",
    { dialect: 'postgres', protocol: 'postgres' });
}
  
class Room extends Sequelize.Model { }
Room.init( {
  name: {type: Sequelize.STRING, allowNull: false, unique: true},
  length: {type: Sequelize.FLOAT, allowNull: false},
  width: {type: Sequelize.FLOAT, allowNull: false},
  height: {type: Sequelize.FLOAT, allowNull: false}
}, { sequelize, modelName: 'room' } );


module.exports = { Room:Room }

