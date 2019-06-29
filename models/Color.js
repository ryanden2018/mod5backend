const Sequelize = require('sequelize');

const sequelize = new Sequelize('roombuilder','postgres','abcdef',
  { host: 'localhost', dialect: 'postgres' });
 

class Color extends Sequelize.Model { }
Color.init( {
  name: {type: Sequelize.STRING, allowNull: false, unique: true, primaryKey: true},
  red: {type: Sequelize.INTEGER, allowNull: false},
  green: {type: Sequelize.INTEGER, allowNull: false},
  blue: {type: Sequelize.INTEGER, allowNull: false}
}, { sequelize, modelName: 'color' } );


module.exports = { Color:Color }

