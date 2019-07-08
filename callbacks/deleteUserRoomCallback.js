const authorizeUser = require('../helpers/authorizeUser');
const getId = require('../helpers/getId');
const UserRoom = require('../models/UserRoom');

// deleteUserRoomCallback(req,res)
// Remove association between a user and a room they are invited to but *don't* own
//   req: request, must contain:
//             req.body.roomId: the ID of the room to de-associate from the current user
//             req must contain a JWT cookie
//   res: response, will be JSON {success: "operation completed"} if successful
function deleteUserRoomCallback(req,res) {
  authorizeUser( req,res,null, async (username) => {
    var userId = await getId(username);
    var roomId = req.body.roomId;
    UserRoom.UserRoom.findAll({where: {userId: userId, roomId: roomId, isOwner: false}})
    .then( userRooms => {
      if(userRooms.length > 0) {
        var userRoom = userRooms[0];
        userRoom.destroy({force:true})
        .then( () => res.status(200).json({success: "operation completed"}) )
        .catch( () => res.status(500).json({error:"could not delete association"}) );
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error: "could not find association"}) );
  });
}

module.exports = deleteUserRoomCallback;
