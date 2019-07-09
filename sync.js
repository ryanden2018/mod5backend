const User = require('./models/User')
const Room = require('./models/Room')
const UserRoom = require('./models/UserRoom');
const Color = require('./models/Color');
const Furnishing = require('./models/Furnishing');
const FurnishingLock = require('./models/FurnishingLock');

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
    })
  });
});
