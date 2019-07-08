const Color = require('../models/Color');

function getColorsCallback(req,res) {
  Color.Color.findAll()
  .then( colors => {
    res.status(200).json(colors);
  })
  .catch( () => res.status(500).json({error:"error getting colors"}) );
}

module.exports = getColorsCallback;
