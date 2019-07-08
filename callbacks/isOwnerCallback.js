const authorizeUser = require('../helpers/authorizeUser');
const getId = require('../helpers/getId');
const UserRoom = require('../models/UserRoom');

// isOwnerCallback(req,res)
// Find out whether or not the current user owns a particular room.
//   req: request, must contain:
//                   req.params.id: ID of a room
//                   req must contain JWT cookie (see authorizeUser)
//   res: response, JSON of {status: BOOLEAN}
function isOwnerCallback(req,res) {
  authorizeUser(req,res,null, async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll({where:{roomId:req.params.id,userId:userId}})
    .then(userRooms => {
      if(userRooms.length > 0) {
        res.status(200).json( {status: userRooms[0].isOwner});
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error:"could not find association"}) );
  });
}

module.exports = isOwnerCallback;
