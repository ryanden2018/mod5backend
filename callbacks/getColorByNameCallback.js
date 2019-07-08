const Color = require('../models/Color');

// getColorByNameCallback(req,res)
// Look-up color by name (to obtain RGB values)
//   req: request, must contain:
//               req.params.colorName: the name of the color to retrieve
//   res: response, will be the JSON color object if found (see Color model)
function getColorByNameCallback(req,res) {
  Color.Color.findAll({where:{name:req.params.colorName}})
  .then( colors => {
    if(colors.length > 0) {
      res.status(200).json(colors[0]);
    } else {
      res.status(404).json({error:"color not found"});
    }
  }).catch( () => { 
    res.status(500).json({error:"error getting color"});
  });
}

module.exports = getColorByNameCallback;
