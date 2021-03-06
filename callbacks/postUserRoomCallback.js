const authorizeUser = require('../helpers/authorizeUser');
const getId = require('../helpers/getId');
const UserRoom = require('../models/UserRoom');


// postUserRoomCallback(req,res)
// Add a collaborator to a particular room. Only the owner of the room can do this.
//   req: request, must contain:
//               req.body.recipientUsername: the username of the user to add as collaborator
//               req.body.roomId: the room upon which collaboration occurs
//               req must contain JWT cookie
//   res: response, will be {success: "operation complete"} upon successful post
// req.body: {recipientUsername: ..., roomId: ...}
function postUserRoomCallback(req,res) {
  authorizeUser(req,res,null, async (username) => {
    var ownerId = await getId(username);
    var recipientId = await getId(req.body.recipientUsername);
    var roomId = req.body.roomId;
    UserRoom.UserRoom.findAll({ where: { userId: ownerId, roomId: roomId } })
    .then( userRooms => {
      if(userRooms.length > 0) {
        var userRoom = userRooms[0];
        if(userRoom.isOwner) {
          UserRoom.UserRoom.create({ roomId: roomId, userId: recipientId, isOwner: false, confirmed: false })
          .then( () => res.status(200).json({success: "operation complete"}) )
          .catch( () => res.status(500).json({error: "could not create association"}) );
        } else {
          res.status(401).json({error: "Unauthorized"});
        }
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error: "could not find association"}) );
  });
}

module.exports = postUserRoomCallback;
