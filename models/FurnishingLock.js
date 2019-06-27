const Furnishing = require('./Furnishing');
const User = require('./User');

const Sequelize = require('sequelize');

const sequelize = new Sequelize('roombuilder','postgres','abcdef',
  { host: 'localhost', dialect: 'postgres' });
 

class FurnishingLock extends Sequelize.Model { }
FurnishingLock.init( {
  furnishingId: { type: Sequelize.UUID, allowNull: false, unique: true },
  userId: { type: Sequelize.INTEGER, allowNull: false, unique: true}
}, { sequelize, modelName: 'furnishingLock' } );


module.exports = { FurnishingLock:FurnishingLock }

