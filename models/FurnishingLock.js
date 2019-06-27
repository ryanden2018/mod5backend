const Furnishing = require('./Furnishing');
const User = require('./User');

const Sequelize = require('sequelize');

const sequelize = new Sequelize('roombuilder','postgres','abcdef',
  { host: 'localhost', dialect: 'postgres' });
 

class FurnishingLock extends Sequelize.Model { }
FurnishingLock.init( {
}, { sequelize, modelName: 'furnishing' } );


FurnishingLock.belongsTo(Furnishing.Furnishing)
FurnishingLock.belongsTo(User.User)

module.exports = { FurnishingLock:FurnishingLock }

