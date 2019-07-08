const authorizeUser = require('../helpers/authorizeUser');
const Furnishing = require('../models/Furnishing');
const Room = require('../models/Room');

// patchFurnishingCallback(req,res)
// Update a furnishing item.
//   req: request, must contain:
//                 req.params.id: the ID (uuid) of the furnishing to update
//                 req.body: an object of the form {furnishing: {...}}
//                               so req.body.furnishing exists
//                 request must contain JWT cookie
//   res: response, will be JSON of the new furnishing upon successful update
function patchFurnishingCallback(req,res) {
  authorizeUser(req,res,null, (username) => {
    Furnishing.Furnishing.findByPk(req.params.id)
    .then( furnishing => {
      Room.Room.findByPk(furnishing.roomId)
      .then( room => {
        room.getUsers()
        .then( users => {
          var user = users.find(user => user.username === username);
          if(user) {
            furnishing.update({...req.body.furnishing, roomId: room.id})
            .then( furnishing => res.status(200).json(furnishing) )
            .catch( () => res.status(500).json({error:"Could not update furnishing"}) );
          } else {
            res.status(401).json({error:"Unauthorized"});
          }
        }).catch( () => res.status(500).json({error:"error getting users"}) );
      }).catch( () => res.status(500).json({error:"could not get room"}) );
    }).catch( () => res.status(404).json({error:"furnishing not found"}) );
  });
}

module.exports = patchFurnishingCallback;
