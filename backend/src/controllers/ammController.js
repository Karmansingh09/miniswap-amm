const ammService = require('../services/ammService');

async function quoteBuy(req, res) {
  try {
    const { assetAmount } = req.body;

    if (assetAmount === undefined || assetAmount === null) {
      return res.status(400).json({
        success: false,
        message: 'assetAmount is required',
      });
    }

    const result = ammService.quoteBuy(assetAmount);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  quoteBuy,
};
