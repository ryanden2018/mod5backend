const authorizeUser = require('../helpers/authorizeUser');
const Room = require('../models/Room');


// req.body: {room: {...}}
function patchRoomCallback(req,res) {
  authorizeUser(req,res,null, async (username) => {
    var id = await getId(username);
    Room.Room.findByPk( req.params.id )
    .then( room => {
      room.getUsers({where: {userId: id}})
      .then( users => {
        if(users.length > 0) {
          room.update(req.body.room)
          .then( () => res.json(room) )
          .catch( () => res.status(500).json({error:"could not update room"}) );
        } else {
          res.status(500).json({error:"user not found in room collaborators list"});
        }
      }).catch( () => res.status(500).json({error:"user not found in room collaborators list"}) );
    }).catch( () => res.status(404).json({error:"room not found"}) );
  });
}

module.exports = patchRoomCallback;
