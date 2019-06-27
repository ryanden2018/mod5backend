const User = require('./models/User')
const Room = require('./models/Room')
const UserRoom = require('./models/UserRoom');
const Color = require('./models/Color');
const Furnishing = require('./models/Furnishing');
const FurnishingLock = require('./models/FurnishingLock');
const bcrypt = require('bcrypt');

bcrypt.hash("abcdef",10, (err,hash) => {
  User.User.create({username:"jonsnow",passwordDigest:hash})
  .then( jonsnow =>
    User.User.create({username:"cersei",passwordHash:hash})
    .then( cersei => {
      Room.Room.create({length:10,width:10,height:10})
      .then( room => {
        UserRoom.UserRoom.create({userId: jonsnow.id, roomId: room.id, isOwner: true, confirmed: true});
        UserRoom.UserRoom.create({userId: cersei.id, roomId: room.id, isOwner: false, confirmed: true});
        Furnishing.Furnishing.create({type:"table",posx:0,posy:0,theta:0,roomId:room.id,colorName:"blue"});
      });
    })
  );
})

