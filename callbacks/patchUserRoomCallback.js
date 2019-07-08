const authorizeUser = require('../helpers/authorizeUser');
const getId = require('../helpers/getId');
const UserRoom = require('../models/UserRoom');

 // body: {roomId: ..., confirmed: ...}
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
