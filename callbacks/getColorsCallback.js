const Color = require('../models/Color');

// getColorsCallback(req,res)
// Retrieve all available colors from the Color table
//   req: request
//   res: response, will be JSON containing all entries of Color table
//                  (see Color model)
function getColorsCallback(req,res) {
  Color.Color.findAll()
  .then( colors => {
    res.status(200).json(colors);
  })
  .catch( () => res.status(500).json({error:"error getting colors"}) );
}

module.exports = getColorsCallback;
