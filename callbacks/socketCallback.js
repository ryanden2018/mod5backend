const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const genSecrets = require('../helpers/genSecrets');
const User = require('../models/User');
const UserRoom = require('../models/UserRoom');
const Furnishing = require('../models/Furnishing');
const FurnishingLock = require('../models/FurnishingLock');

// verifyAuthCookie(socket,successCallback,failureCallback = () => {})
// Check whether the socket headers contain a valid JWT auth cookie. This is
// used by all the socket events since the user must log in *before* the socket
// is created (else the cookie header will not exist).
//   socket: the current socket
//   successCallback: calls this if user is logged in, with an argument of the user ID
//   failureCallback: calls this otherwise, defaults to () => {}
function verifyAuthCookie(socket,successCallback,failureCallback = () => { }) {
  if(socket && socket.request && socket.request.headers && socket.request.headers.cookie) {
    var cookies = cookie.parse(socket.request.headers.cookie);
    if(cookies.rmbrAuthToken) {
      jwt.verify(cookies.rmbrAuthToken,genSecrets.publicKey, genSecrets.verifyOptions, (err,results) => {
        if(results && !err) {
          successCallback(results.id);
        } else {
          failureCallback();
        }
      });
    } else {
      failureCallback();
    }
  } else {
    failureCallback();
  }
}


// socketCallback(socket)
// Defines all server responses for the socket.
function socketCallback(socket) {

  /////////////////////////////////////////////////////////////////////////////
  // place client in a room, removing them from all other rooms
  // note: client can only join a room they are authorized to be in
  // requires:
  //            payload.roomId : the room to join
  // emits to socket:
  //            "joinResponse" of either `joined room ${payload.roomId}` or "failed"
  /////////////////////////////////////////////////////////////////////////////
  socket.on("join", function(payload) {
    let rooms = Object.keys(socket.rooms);
    rooms.forEach( room => {
      if(room.match(/room \d+/)) {
        socket.leave(room);
      }
    });
    verifyAuthCookie(socket, userId => {
      UserRoom.UserRoom.findAll({where: {userId: userId, roomId: payload.roomId}})
      .then( userRooms => {
        if(userRooms.length > 0) {
          socket.join(`room ${payload.roomId}`);
          socket.emit("joinResponse",`joined room ${payload.roomId}`);
        } else {
          socket.emit("joinResponse","failed");
        }
      }).catch( () => socket.emit("joinResponse","failed") );
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // remove client from a room
  // requires:
  //                payload.roomId : the room to leave
  // emits: nothing
  /////////////////////////////////////////////////////////////////////////////
  socket.on("leave", function(payload) {
    socket.leave(`room ${payload.roomId}`);
  });


  /////////////////////////////////////////////////////////////////////////////
  // check whether client is logged in - this should only be fired
  // AFTER a successful reconnection
  // emits:
  //                  "loggedInResponse" either "logged in" or "not logged in"
  /////////////////////////////////////////////////////////////////////////////
  socket.on("loggedIn",function(payload) {
    verifyAuthCookie(socket,
      () => socket.emit("loggedInResponse","logged in"),
      () => socket.emit("loggedInResponse","not logged in")
    );
  });

  /////////////////////////////////////////////////////////////////////////////
  // user requests a lock on furniture item (no authorization here, for speed,
  // but note that furniture ID is a uuid hence effectively impossible to guess,
  // and even if guessed, all you obtain is a lock, not creation, deletion or update).
  // payload:
  //                payload.furnishingId: the ID (uuid) of furnishing to lock
  // emits to socket:
  //                "lockResponse" of either "approved" or "denied"
  /////////////////////////////////////////////////////////////////////////////
  socket.on("lockRequest", function(payload) {
    verifyAuthCookie(socket, userId => {
      // release stale locks
      FurnishingLock.FurnishingLock.findAll()
      .then( locks => {
        locks.forEach( lock => {
          if( (new Date())-lock.updatedAt > 2500 ) {
            lock.destroy({force:true});
          }
        });
      }).catch( () => { } )

      // create new lock
      FurnishingLock.FurnishingLock.create({userId:userId,furnishingId:payload.furnishingId})
      .then(() => socket.emit("lockResponse","approved"))
      .catch(() => socket.emit("lockResponse","denied"));
    }, () => {
      socket.emit("lockResponse","denied");
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // user moves mouse while locked onto furniture item (does not persist!)
  // emits to room:
  //              "mouseMoved" event passing the payload along.
  /////////////////////////////////////////////////////////////////////////////
  socket.on("mouseMoved", function(payload) {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1])
        socket.to(`room ${roomId}`).emit("mouseMoved",payload);
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // user refreshes timestamp on lock
  // emits to socket:
  //               "lockRefreshResponse" of either "approved" or "denied"
  /////////////////////////////////////////////////////////////////////////////
  socket.on("lockRefresh", function(payload) {
    verifyAuthCookie(socket, userId => {
      FurnishingLock.FurnishingLock.findAll({where:{userId:userId}})
      .then( locks => {
        if(locks.length > 0) {
          var lock = locks[0];
          lock.update({refreshes: lock.refreshes+1});
          socket.emit("lockRefreshResponse","approved");
        } else {
          socket.emit("lockRefreshResponse","denied");
        }
      }).catch( () => socket.emit("lockRefreshResponse","denied") );
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // user releases lock on furniture item
  // payload:
  //               payload.furnishing : new furnishing properties
  // emits to room:
  //               "update" passing the payload along
  /////////////////////////////////////////////////////////////////////////////
  socket.on("lockRelease", function(payload) {
    verifyAuthCookie(socket, userId => {
      FurnishingLock.FurnishingLock.findAll({ where: {userId: userId} })
      .then( locks => {
        locks.forEach( lock => {
          lock.destroy({force:true}).catch(() => { });
        });
      }).catch( () => { } );
      if(payload && payload.furnishing) {
        let rooms = Object.keys(socket.rooms);
        let roomStr = rooms.find( room => room.match(/room \d+/))
        if(roomStr) {
          let roomId = parseInt(roomStr.split(" ")[1])
          Furnishing.Furnishing.update({...payload.furnishing, roomId: roomId},
            {where: {id:payload.furnishing.id,roomId:roomId} });
          socket.to(`room ${roomId}`).emit("update",payload);
        }
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // user update color of furniture item -- update the DB and notify othe rusers
  // payload:
  //              payload.furnishingId : the ID (uuid) of the furnishing to update
  //              payload.colorName : the new color name from the Color table
  // emits to room:
  //              "colorUpdate" passing the payload along
  /////////////////////////////////////////////////////////////////////////////
  socket.on("updateColor", function(payload) {
    verifyAuthCookie(socket, userId => {
      if(payload && payload.furnishingId && payload.colorName) {
        let rooms = Object.keys(socket.rooms);
        let roomStr = rooms.find( room => room.match(/room \d+/))
        if(roomStr) {
          let roomId = parseInt(roomStr.split(" ")[1])
          FurnishingLock.FurnishingLock.findAll({where:{furnishingId:payload.furnishingId}})
          .then( locks => {
            if(locks.length === 0) {
              Furnishing.Furnishing.update({colorName:payload.colorName},
                {where:{id:payload.furnishingId, roomId:roomId}} );
              socket.to(`room ${roomId}`).emit("colorUpdate",payload);
            }
          })
          .catch( () => {} );
        }
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // room is deleted by the owner, signal other clients (does nothing to DB)
  // emits to room:
  //                "roomDeleted"
  /////////////////////////////////////////////////////////////////////////////
  socket.on("roomDeleted",function() {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1])
        socket.to(`room ${roomId}`).emit("roomDeleted");
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // return client's available rooms to view
  // emits to socket:
  //                 "availableRooms" an object {availableRooms: rooms}
  /////////////////////////////////////////////////////////////////////////////
  socket.on("getAvailableRooms",function(payload) {
    verifyAuthCookie(socket, userId => {
      User.User.findAll({where:{id:userId}})
      .then( users => {
        if(users.length > 0) {
          var user = users[0];
          user.getRooms().then( rooms => {
            socket.emit("availableRooms",{availableRooms:rooms})
          })
          .catch( () => { } );
        }
      })
      .catch( () => { } );
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // user creates a furniture item -- persist the item to DB and notify other users
  // payload:
  //             payload.furnishing an object representation of the new furnishing
  // emits to room:
  //             "create" passing payload along
  /////////////////////////////////////////////////////////////////////////////
  socket.on("createFurnishing", function(payload) {
    verifyAuthCookie(socket, userId => {
      if(payload && payload.furnishing) {
        let rooms = Object.keys(socket.rooms);
        let roomStr = rooms.find( room => room.match(/room \d+/))
        if(roomStr) {
          let roomId = parseInt(roomStr.split(" ")[1])
          Furnishing.Furnishing.create( {...payload.furnishing,roomId:roomId} )
          socket.to(`room ${roomId}`).emit("create",payload);
        }
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // remove client from all rooms
  /////////////////////////////////////////////////////////////////////////////
  socket.on("removeFromAllRooms", function(payload) {
    let rooms = Object.keys(socket.rooms);
    rooms.forEach( room => {
      if(room.match(/room \d+/)) {
        socket.leave(room);
      }
    });
  });


  /////////////////////////////////////////////////////////////////////////////
  // user deletes a furniture item -- delete from the database and notify other users
  // payload:
  //                   payload.furnishingId
  // emits to room:
  //                   "delete" passing along the payload
  /////////////////////////////////////////////////////////////////////////////
  socket.on("deleteFurnishing", function(payload) {
    verifyAuthCookie(socket, userId => {
      if(payload && payload.furnishingId) {
        let rooms = Object.keys(socket.rooms);
        let roomStr = rooms.find( room => room.match(/room \d+/))
        if(roomStr) {
          let roomId = parseInt(roomStr.split(" ")[1])
          FurnishingLock.FurnishingLock.findAll({where:{furnishingId:payload.furnishingId}})
          .then( locks => {
            if(locks.length === 0) {
              Furnishing.Furnishing.findAll( { where: { id: payload.furnishingId, roomId: roomId } } )
              .then( furnishings => {
                if(furnishings.length > 0) {
                  let furnishing = furnishings[0];
                  furnishing.destroy({force:true})
                }
              }).catch( () => { } )
              socket.to(`room ${roomId}`).emit("delete",payload);
            }
          })
          .catch( () => { } );
        }
      }
    });
  });
}

module.exports = socketCallback;
