const Furnishing = require('../models/Furnishing');

// persistRoom(roomId,room)
// update the furnishings of the room with id roomId to reflect the
// second argument. Note that authorization must occur *before* calling
// this function!
//    roomId: the id of the room to update
//    room: an array of furnishings
function persistRoom(roomId,room) {
  if(room && roomId) {
    foundIds = [];
    Furnishing.Furnishing.findAll( { where: { roomId: roomId } } )
    .then( furnishings => {
      furnishings.forEach( furnishing => {

        let correspondingFurnishing = room.find( cf => ( cf.id === furnishing.id ) );

        if(!correspondingFurnishing) {
          furnishing.destroy({force:true});
        } else {
          foundIds.push(furnishing.id);
          Furnishing.Furnishing.update({...correspondingFurnishing, roomId: roomId},
            {where: {id:furnishing.id,roomId:roomId} });
        }
      });
    });

    room.forEach( furnishing => {
      if( !foundIds.includes(furnishing.id) ) {
        Furnishing.Furnishing.create( {...furnishing, roomId:roomId} );
      }
    });
  }
}

module.exports = persistRoom;
