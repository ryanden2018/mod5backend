const authorizeUser = require('../helpers/authorizeUser');
const getId = require('../helpers/getId');
const UserRoom = require('../models/UserRoom');
const Room = require('../models/Room');

function getRoomCallback(req,res) {
  authorizeUser(req,res,null,async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll({ where: {roomId: req.params.id, userId: userId}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        Room.Room.findByPk(req.params.id)
        .then( room => {
          res.status(200).json(room);
        }).catch( () => res.status(404).json({error:"room not found"}) );
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error:"could not find association"}) );
  });
}

module.exports = getRoomCallback;
