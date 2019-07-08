const authorizeUser = require('../helpers/authorizeUser');

// req.body: {room: {name: ..., length:..., width:..., height:...} }
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
