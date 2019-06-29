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
      Color.Color.create({name:"blue",red:0,green:0,blue:175});
      Color.Color.create({name:"green",red:0,green:175,blue:0});
      Color.Color.create({name:"red",red:175,green:0,blue:0});
      Color.Color.create({name:"yellow",red:175,green:175,blue:0});
      Color.Color.create({name:"pink",red:175,green:Math.round(192*175/255),blue:Math.round(203*175/255)});
      Color.Color.create({name:"purple",red:128,green:0,blue:128});
      Color.Color.create({name:"orange",red:175,green:Math.round(127*175/255),blue:0});
      Color.Color.create({name:"black",red:0,green:0,blue:0});
      Color.Color.create({name:"grey",red:128,green:128,blue:128});
      Color.Color.create({name:"white",red:175,green:175,blue:175});
      Color.Color.create({name:"brown",red:150,green:75,blue:0});

      bcrypt.hash("abcdef",10, (err,hash) => {
        User.User.create({username:"tyrion",passwordDigest:hash});
        User.User.create({username:"jonsnow",passwordDigest:hash})
        .then( jonsnow =>
          User.User.create({username:"cersei",passwordDigest:hash})
          .then( cersei => {
            Room.Room.create({name:"basic room",length:10,width:10,height:10})
            .then( room => {
              UserRoom.UserRoom.create({userId: jonsnow.id, roomId: room.id, isOwner: true, confirmed: true});
              UserRoom.UserRoom.create({userId: cersei.id, roomId: room.id, isOwner: false, confirmed: true});
              Furnishing.Furnishing.create({type:"table",posx:0,posz:0,theta:0,roomId:room.id,colorName:"blue"});
            });
          })
        );
      })

    })
  });
});
