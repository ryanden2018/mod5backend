const Sequelize = require('sequelize');

//const sequelize = new Sequelize('DATABASE','postgres','',
//  { host: process.env.DATABASE_URL, dialect: 'postgres' });

let sequelize;
if(process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL,
    { dialect: 'postgres', protocol: 'postgres' });
} else {
  sequelize = new Sequelize("postgres://postgres:abcdef@localhost:5432/roombuilder",
    { dialect: 'postgres', protocol: 'postgres' });
}

class Color extends Sequelize.Model { }
Color.init( {
  name: {type: Sequelize.STRING, allowNull: false, unique: true, primaryKey: true},
  red: {type: Sequelize.INTEGER, allowNull: false},
  green: {type: Sequelize.INTEGER, allowNull: false},
  blue: {type: Sequelize.INTEGER, allowNull: false}
}, { sequelize, modelName: 'color' } );


module.exports = { Color:Color }

