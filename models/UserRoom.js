const User = require('./User');
const Room = require('./Room');

const Sequelize = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL,
  { dialect: 'postgres', protocol: 'postgres' });
  
class UserRoom extends Sequelize.Model { }
UserRoom.init({
  isOwner: {type:Sequelize.BOOLEAN, allowNull: false},
  confirmed: {type:Sequelize.BOOLEAN, allowNull: false}
},  { sequelize, modelName: 'userRoom' } );


User.User.belongsToMany(Room.Room, {through: UserRoom});
Room.Room.belongsToMany(User.User, {through: UserRoom});


module.exports = { UserRoom : UserRoom }

