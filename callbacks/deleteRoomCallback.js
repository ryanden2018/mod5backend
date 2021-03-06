const Room = require('../models/Room');
const UserRoom = require('../models/UserRoom');
const User = require('../models/User');
const authorizeUser = require('../helpers/authorizeUser');
const Furnishing = require('../models/Furnishing');

// deleteRoomCallback(req,res)
// Delete a room and all furnishings contained inside it. Only the owner of a
// room is authorized to delete it.
//   req: request, must contain:
//                req.params.id: ID of the room to delete
//                req must contain JWT cookie (see authorizeUser)
//   res: response, will be JSON {success: "operation completed"} if successful
function deleteRoomCallback(req,res) {
  Room.Room.findByPk(req.params.id)
  .then( room => {
    UserRoom.UserRoom.findAll({where: {roomId: room.id, isOwner: true}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        User.User.findByPk(userRooms[0].userId)
        .then( user => {
          authorizeUser(req,res,user.username, () => {
            UserRoom.UserRoom.findAll( { where: { roomId: req.params.id } } )
            .then( otherUserRooms => {
              otherUserRooms.forEach( otherUserRoom => otherUserRoom.destroy({force:true}) );
            }).catch( () => { } );
            Furnishing.Furnishing.findAll( { where: { roomId: req.params.id } } )
            .then( furnishings => {
              furnishings.forEach( furnishing => furnishing.destroy({force:true}) );
            }).catch( () => { } );
            room.destroy({force:true})
            .then( () => res.status(200).json({success: "operation completed"}) )
            .catch( () => res.status(500).json({error:"could not delete room"}) );
          });
        }).catch( () => res.status(500).json({error:"could not get username"}) );
      } else {
        res.status(500).json({error:"could not get association"});
      }
    }).catch( () => res.status(500).json({error:"error getting association"}) );
  }).catch( () => res.status(404).json({error:"room not found"}) );
}

module.exports = deleteRoomCallback;
