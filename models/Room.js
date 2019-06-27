const Sequelize = require('sequelize');

const sequelize = new Sequelize('roombuilder','postgres','abcdef',
  { host: 'localhost', dialect: 'postgres' });
 

class Room extends Sequelize.Model { }
Room.init( {
  length: {type: Sequelize.FLOAT, allowNull: false},
  width: {type: Sequelize.FLOAT, allowNull: false},
  height: {type: Sequelize.FLOAT, allowNull: false}
}, { sequelize, modelName: 'room' } );


module.exports = { Room:Room }
