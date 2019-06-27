const uuid = require('uuid/v4');
const Room = require('./Room');
const Color = require('./Color');

const Sequelize = require('sequelize');

const sequelize = new Sequelize('roombuilder','postgres','abcdef',
  { host: 'localhost', dialect: 'postgres' });
 

class Furnishing extends Sequelize.Model { }
Furnishing.init( {
  id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: uuid() },
  type: {type: Sequelize.STRING, allowNull: false}, // table, chair, stool, desk, sofa, bed, bookcase, dresser
  posx: {type:Sequelize.FLOAT, allowNull: false},
  posy: {type:Sequelize.FLOAT, allowNull: false},
  theta: {type: Sequelize.FLOAT, allowNull: false},
  params: { type: Sequelize.STRING } // extra parameters
}, { sequelize, modelName: 'furnishing' } );


Furnishing.belongsTo(Room.Room)
Furnishing.belongsTo(Color.Color)

module.exports = { Furnishing:Furnishing }

