const authorizeUser = require('../helpers/authorizeUser');
const getId = require('../helpers/getId');
const UserRoom = require('../models/UserRoom');
const Furnishing = require('../models/Furnishing');

// postFurnishingCallback(req,res)
// Create a new furnishing.
//   req: request, must contain:
//            req.body: an object of the form
//                  {furnishing: { type: ..., posx: ..., posy: ..., theta: ..., roomId: ..., color: ... } }
//            request must contain a JWT cookie
//   res: response, will be JSON of the new furnishing upon successful post
function postFurnishingCallback(req,res) {
  authorizeUser(req,res,null, async (username) => {
    var userId = await getId(username);
    UserRoom.UserRoom.findAll( { where: { roomId: req.body.furnishing.roomId, userId: userId } } )
    .then( userRooms => {
      if(userRooms.length > 0) {
        Furnishing.Furnishing.create( req.body.furnishing )
        .then( furnishing => res.status(200).json(furnishing) )
        .catch( () => res.status(500).json({error:"could not create furnishing"}) );
      } else {
        res.status(500).json({error: "could not find association"})
      }
    }).catch( () => res.status(500).json({error: "could not find association"}) );
  });
}

module.exports = postFurnishingCallback;
