const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const genSecrets = require('../helpers/genSecrets');
const User = require('../models/User');
const UserRoom = require('../models/UserRoom');
const Furnishing = require('../models/Furnishing');
const persistRoom = require('../helpers/persistRoom');
const Redis = require('ioredis');
const redis = new Redis( process.env.REDIS_URL || 6379 );

// verifyAuthCookie(socket,successCallback,failureCallback = () => {})
// Check whether the socket headers contain a valid JWT auth cookie. This is
// used by all the socket events since the user must log in *before* the socket
// is created (else the cookie header will not exist).
//   socket: the current socket
//   successCallback: calls this if user is logged in, with arguments of the user ID and username
//   failureCallback: calls this otherwise, defaults to () => {}
function verifyAuthCookie(socket,successCallback,failureCallback = () => { }) {
  if(socket && socket.request && socket.request.headers && socket.request.headers.cookie) {
    var cookies = cookie.parse(socket.request.headers.cookie);
    if(cookies.rmbrAuthToken) {
      jwt.verify(cookies.rmbrAuthToken,genSecrets.publicKey, genSecrets.verifyOptions, (err,results) => {
        if(results && !err) {
          successCallback(results.id, results.username);
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
  socket.on("loggedInReconnectEvent",function(payload) {
    verifyAuthCookie(socket,
      () => socket.emit("loggedInReconnectEventResponse","logged in"),
      () => socket.emit("loggedInReconnectEventResponse","not logged in")
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
    verifyAuthCookie(socket, (userId,username) => {
      if(username === "dummy") {
        socket.emit("lockResponse","approved");
      } else {
        redis.get(payload.furnishingId)
        .then( result => {
          if(!result) {
            redis.set(payload.furnishingId, userId, 'PX', 2500);
            socket.emit("lockResponse","approved");
          } else {
            socket.emit("lockResponse","denied");
          }
        }).catch( () => socket.emit("lockResponse","denied") );
      }
    }, () => {
      socket.emit("lockResponse","denied");
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // notify every client to push the room to the undo stack
  // emits to room:
  //                  "pushRoomToUndoStack" passing on the payload
  /////////////////////////////////////////////////////////////////////////////
  socket.on("pushRoomToUndoStack",function(payload) {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1])
        socket.to(`room ${roomId}`).emit("pushRoomToUndoStack",payload);
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // notify every client to push the room to the redo stack
  // emits to room:
  //                  "pushRoomToRedoStack" passing on the payload
  /////////////////////////////////////////////////////////////////////////////
  socket.on("pushRoomToRedoStack",function(payload) {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1])
        socket.to(`room ${roomId}`).emit("pushRoomToRedoStack",payload);
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // notify every client to undo and persist payload to the room in DB
  // payload:
  //                   payload.room: the new room in object representation to persist to DB
  // emits to room:
  //                  "undo" passing on the payload
  /////////////////////////////////////////////////////////////////////////////
  socket.on("undo",function(payload) {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1]);
        Furnishing.Furnishing.findAll({
          where: { roomId: roomId }
        }).then( furnishings => {
          let furnishingIds = furnishings.map(furnishing => furnishing.id);
          redis.mget(furnishingIds)
          .then( result => {
            if(!result.find( val => !!val ) ) {
              persistRoom(roomId,payload.room);
              socket.to(`room ${roomId}`).emit("undo",payload);
              socket.emit("undo",payload);
            }
          }).catch( () => { } );
        }).catch( () => {} );
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // notify every client to redo and persist payload to the room in DB
  // payload:
  //                  payload.room: the new room in object representation to persist to DB
  // emits to room:
  //                  "redo" passing on the payload
  /////////////////////////////////////////////////////////////////////////////
  socket.on("redo",function(payload) {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1]);
        Furnishing.Furnishing.findAll({
          where: { roomId: roomId }
        }).then( furnishings => {
          let furnishingIds = furnishings.map(furnishing => furnishing.id);
          redis.mget(furnishingIds)
          .then( result => {
            if(!result.find( val => !!val ) ) {
              persistRoom(roomId,payload.room);
              socket.to(`room ${roomId}`).emit("redo",payload);
              socket.emit("redo",payload);
            }
          }).catch( () => { } );
        }).catch( () => {} );
      }
    });
  });


   /////////////////////////////////////////////////////////////////////////////
  // notify every client to clear the undo stack
  // emits to room:
  //                  "clearUndoStack" passing on the payload
  /////////////////////////////////////////////////////////////////////////////
  socket.on("clearUndoStack",function(payload) {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1])
        socket.to(`room ${roomId}`).emit("clearUndoStack",payload);
      }
    });
  });

  /////////////////////////////////////////////////////////////////////////////
  // notify every client to clear the redo stack
  // emits to room:
  //                  "clearRedoStack" passing on the payload
  /////////////////////////////////////////////////////////////////////////////
  socket.on("clearRedoStack",function(payload) {
    verifyAuthCookie(socket, userId => {
      let rooms = Object.keys(socket.rooms);
      let roomStr = rooms.find( room => room.match(/room \d+/))
      if(roomStr) {
        let roomId = parseInt(roomStr.split(" ")[1])
        socket.to(`room ${roomId}`).emit("clearRedoStack",payload);
      }
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
    verifyAuthCookie(socket, (userId,username) => {
      if(username === "dummy") {
        socket.emit("lockRefreshResponse","approved");
      } else {
        redis.get(payload.furnishingId)
        .then( result => {
          if(parseInt(result) === parseInt(userId)) {
            redis.set(payload.furnishingId, userId, 'PX', 2500);
            socket.emit("lockRefreshResponse","approved");
          } else {
            socket.emit("lockRefreshResponse","denied");
          }
        }).catch( () => socket.emit("lockRefreshResponse","denied") );
      }
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
      if(payload && payload.furnishing) {
        redis.del(payload.furnishing.id);
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
  // user update color of furniture item -- update the DB and notify other users
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
          redis.get(payload.furnishingId)
          .then( result => {
            if(!result) {
              Furnishing.Furnishing.update({colorName:payload.colorName},
                  {where:{id:payload.furnishingId, roomId:roomId}} );
              socket.to(`room ${roomId}`).emit("colorUpdate",payload);
              socket.emit("colorUpdate",payload);
            }
          }).catch(() => { } );
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

          redis.get(payload.furnishingId)
          .then( result => {
            if(!result) {
              Furnishing.Furnishing.findAll( { where: { id: payload.furnishingId, roomId: roomId } } )
              .then( furnishings => {
                if(furnishings.length > 0) {
                  let furnishing = furnishings[0];
                  furnishing.destroy({force:true})
                }
              }).catch( () => { } )
              socket.to(`room ${roomId}`).emit("delete",payload);
              socket.emit("delete",payload);
            }
          }).catch( () => { } );
        }
      }
    });
  });
}

module.exports = socketCallback;
