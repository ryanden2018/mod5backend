const authorizeUser = require('../helpers/authorizeUser');
const getId = require('../helpers/getId');
const Room = require('../models/Room');
const UserRoom = require('../models/UserRoom');

// postRoomsCallback(req,res)
// Create a new room.
//    req: request, must contain:
//                req.body: an object of the form
//                     {room: {name: ..., length:..., width:..., height:...} }
//                req must contain JWT cookie
//    res: response, will be JSON of the new room upon successful post
function postRoomsCallback(req,res) {
  authorizeUser(req,res,null, async (username) => {
    var id = await getId(username);
    Room.Room.create(req.body.room).then( room => {
      UserRoom.UserRoom.create( {userId: id, roomId: room.id, isOwner: true, confirmed: true} )
      .then( () => res.json(room) )
      .catch( () => res.status(500).json({error:"could not create association"}) );
    }).catch( () => res.status(500).json({error:"could not create room"}) );
  });
}

module.exports = postRoomsCallback;
