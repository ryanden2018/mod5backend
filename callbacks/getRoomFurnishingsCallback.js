const authorizeUser = require('../helpers/authorizeUser');
const UserRoom = require('../models/UserRoom');
const Room = require('../models/Room');
const Furnishing = require('../models/Furnishing');
const getId = require('../helpers/getId');

// getRoomFurnishingsCallback(req,res)
// Get all furnishings for a particular room.
//   req: request, must contain:
//                   req.params.id: ID of the room whose furniture items to fetch
//                   req must contain JWT cookie (see authorizeUser)
//   res: response, will be JSON of all furnishings found (see Furnishing model)
function getRoomFurnishingsCallback(req,res) {
  authorizeUser(req,res,null,async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll({ where: {roomId: req.params.id, userId: userId}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        Room.Room.findByPk(req.params.id)
        .then( () => {
          Furnishing.Furnishing.findAll( { where: { roomId: req.params.id } } )
          .then( furnishings => {
            res.status(200).json( furnishings );
          }).catch( () => res.status(500).json({error:"could not get furnishings"}) );
        }).catch( () => res.status(404).json({error:"room not found"}) );
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error:"could not find association"}) );
  });
}

module.exports = getRoomFurnishingsCallback;
