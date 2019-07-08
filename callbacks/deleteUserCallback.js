const authorizeUser = require('../helpers/authorizeUser');
const User = require('../models/User');
const UserRoom = require('../models/UserRoom');
const Room = require('../models/Room');
const Furnishing = require('../models/Furnishing');

// deleteUserCallback(req,res)
// Delete a user and all their rooms (including furnishings inside those rooms)
//   req: request, must contain:
//             req.params.username: the username of the user to delete (can only be the
//                                  currently logged in user)
//             req must contain JWT cookie (see authorizeUser)
//   res: response, will be JSON {success:"operation succeeded"} if successful
function deleteUserCallback(req,res) {
  authorizeUser(req,res,req.params.username,
    () => {
      User.User.findAll({where:{username:req.params.username}})
      .then( users => {
        if(users.length > 0) {
          var user = users[0];
          var userId = user.id;

          UserRoom.UserRoom.findAll( { where: { userId:userId, isOwner:true} } )
          .then( userRooms => {
            userRooms.forEach( userRoom => {
              Room.Room.findByPk( userRoom.roomId )
              .then( room => {
                UserRoom.UserRoom.findAll( { where: { roomId: room.id } } )
                .then( otherUserRooms => { 
                  otherUserRooms.forEach( otherUserRoom => otherUserRoom.destory({force:true}) )
                })
                .catch( () => { } )
                Furnishing.Furnishing.findAll( { where: { roomId: room.id } } )
                .then( furnishings => {
                  furnishings.forEach( furnishing => furnishing.destroy({force:true}) )
                }).catch( () => { } );
                room.destroy({force:true});
              }).catch( () => { } );
            });
          }).catch( () => { } );

          UserRoom.UserRoom.findAll( { where: { userId: userId } } )
          .then( userRooms => {
            userRooms.forEach( userRoom => userRoom.destroy({force:true}) );
          })
          .catch( () => { } );

          user.destroy({force:true})
          .then( () => res.status(200).json({success:"operation succeeded"}) )
          .catch( () => res.status(500).json({error:"could not delete user"}) );
        } else {
          res.status(401).json({error:"Unauthorized"});
        }
      }).catch(() => {
        res.status(500).json({error:"Error querying users"});
      })
    }
  );
}

module.exports = deleteUserCallback;
