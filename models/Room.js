const Sequelize = require('sequelize');

const sequelize = new Sequelize('DATABASE','postgres','',
  { host: process.env.DATABASE_URL, dialect: 'postgres' });

class Room extends Sequelize.Model { }
Room.init( {
  name: {type: Sequelize.STRING, allowNull: false},
  length: {type: Sequelize.FLOAT, allowNull: false},
  width: {type: Sequelize.FLOAT, allowNull: false},
  height: {type: Sequelize.FLOAT, allowNull: false}
}, { sequelize, modelName: 'room' } );


module.exports = { Room:Room }

