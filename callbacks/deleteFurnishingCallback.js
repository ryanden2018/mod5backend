const authorizeUser = require('../helpers/authorizeUser');
const Furnishing = require('../models/Furnishing');
const Room = require('../models/Room');

// deleteFurnishingCallback(req,res)
// Delete a row from the Furnishings table
//   req: request, must contain:
//                req.params.id: the id (uuid) of the furnishing to remove
//                req must contain JWT cookie (see authorizeUser)
//   res: response, will be JSON {success:"Operation completed"} if successful
function deleteFurnishingCallback(req,res) {
  authorizeUser(req,res,null, (username) => {
    Furnishing.Furnishing.findByPk(req.params.id)
    .then( furnishing => {
      Room.Room.findByPk(furnishing.roomId)
      .then( room => {
        room.getUsers()
        .then( users => {
          var user = users.find(user => user.username === username);
          if(user) {
            furnishing.destroy({force:true})
            .then( () => res.status(200).json({success:"Operation completed"}) )
            .catch( () => res.status(500).json({error:"Could not delete furnishing"}) );
          } else {
            res.status(401).json({error:"Unauthorized"});
          }
        }).catch( () => res.status(500).json({error:"error getting users"}) );
      }).catch( () => res.status(500).json({error:"could not get room"}) );
    }).catch( () => res.status(404).json({error:"furnishing not found"}) );
  });
}

module.exports = deleteFurnishingCallback;
