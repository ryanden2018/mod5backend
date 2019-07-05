const Furnishing = require('./Furnishing');
const User = require('./User');

const Sequelize = require('sequelize');

let sequelize;
if(process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL,
    { dialect: 'postgres', protocol: 'postgres' });
} else {
  sequelize = new Sequelize("postgres://postgres:abcdef@localhost:5432/roombuilder",
    { dialect: 'postgres', protocol: 'postgres' });
}
  
class FurnishingLock extends Sequelize.Model { }
FurnishingLock.init( {
  furnishingId: { type: Sequelize.UUID, allowNull: false, unique: true },
  userId: { type: Sequelize.INTEGER, allowNull: false, unique: true},
  refreshes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
}, { sequelize, modelName: 'furnishingLock' } );


module.exports = { FurnishingLock:FurnishingLock }

