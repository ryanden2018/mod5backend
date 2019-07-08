const authorizeUser = require('../helpers/authorizeUser');
const User = require('../models/User');


// getRoomsCallback(req,res)
// Fetch all rooms for which the current user is a collaborator.
//   req: request, must contain:
//             req.params.username: the username of the user to fetch rooms for
//             req must contain JWT cookie
//   res: response, will be JSON representation of all the rooms (see Room model)
function getRoomsCallback(req,res) {
  authorizeUser(req,res,req.params.username, () => {
    User.User.findAll({where:{username:req.params.username}})
    .then( users => {
      if(users.length > 0) {
        var user = users[0];
        user.getRooms().then( rooms => {
          res.json(rooms);
        })
        .catch( () => res.status(500).json({error: "error finding rooms"}) );
      } else {
        res.status(500).json({error:"error finding user"});
      }
    })
    .catch( () => res.status(500).json({error:"error finding user"}) );
  });
}

module.exports = getRoomsCallback;
