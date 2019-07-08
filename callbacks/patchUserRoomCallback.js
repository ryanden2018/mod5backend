const authorizeUser = require('../helpers/authorizeUser');
const getId = require('../helpers/getId');
const UserRoom = require('../models/UserRoom');

// patchUserRoomCallback(req,res)
// Set whether or not the user is a "confirmed" collaborator (note: this feature is
// not in use in the current implementation).
//    req: request, must contain:
//              req.body: object of the form  {roomId: INTEGER, confirmed: BOOLEAN}
//              req must contain JWT cookie (see authorizeUser)
//    res: response, will be JSON {success: "operation completed"} upon successful update
function patchUserRoomCallback(req,res) {
  authorizeUser( req, res, null, async (username) => {
    var userId = await getId(username);
    var roomId = req.body.roomId;
    UserRoom.UserRoom.findAll({ where: { userId: userId, roomId: roomId } } )
    .then( userRooms => {
      if(userRooms.length > 0) {
        var userRoom = userRooms[0];
        userRoom.update({confirmed: req.body.confirmed})
        .then( () => res.status(200).json({success: "operation completed"}) )
        .catch( () => res.status(500).json({error: "could not update association"}) );
      } else {
        res.status(500).json({error:"could not find association"});
      }
    }).catch( () => res.status(500).json({error: "could not find association"}) );
  });
}

module.exports = patchUserRoomCallback;
