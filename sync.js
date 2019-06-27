const User = require('./models/User')
const Room = require('./models/Room')
const UserRoom = require('./models/UserRoom');
const Color = require('./models/Color');
const Furnishing = require('./models/Furnishing');
const FurnishingLock = require('./models/FurnishingLock');
const bcrypt = require('bcrypt');

const forceSync = true;

User.User.sync({force:forceSync})
.then( () => {
  Room.Room.sync({force:forceSync})
  .then( () => {
    UserRoom.UserRoom.sync({force:forceSync})
    Color.Color.sync({force:true})
    .then( () => {
      Furnishing.Furnishing.sync({force:forceSync})
      .then( () => {
        FurnishingLock.FurnishingLock.sync({force:true});
      });
      Color.Color.create({name:"blue",red:0,green:0,blue:255});
      Color.Color.create({name:"green",red:0,green:255,blue:0});
      Color.Color.create({name:"red",red:255,green:0,blue:0});
      Color.Color.create({name:"yellow",red:255,green:255,blue:0});
      Color.Color.create({name:"pink",red:255,green:192,blue:203});
      Color.Color.create({name:"purple",red:128,green:0,blue:128});
      Color.Color.create({name:"orange",red:255,green:127,blue:0});
      Color.Color.create({name:"black",red:0,green:0,blue:0});
      Color.Color.create({name:"grey",red:128,green:128,blue:128});
      Color.Color.create({name:"white",red:255,green:255,blue:255});
      Color.Color.create({name:"brown",red:150,green:75,blue:0});

      bcrypt.hash("abcdef",10, (err,hash) => {
        User.User.create({username:"tyrion",passwordDigest:hash});
        User.User.create({username:"jonsnow",passwordDigest:hash})
        .then( jonsnow =>
          User.User.create({username:"cersei",passwordDigest:hash})
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

    })
  });
});
