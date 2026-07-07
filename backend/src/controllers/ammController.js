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

async function buyAsset(req, res) {
  try {
    const { assetAmount } = req.body;

    if (assetAmount === undefined || assetAmount === null) {
      return res.status(400).json({
        success: false,
        message: 'assetAmount is required',
      });
    }

    const result = ammService.buyAsset(assetAmount);

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

async function sellAsset(req, res) {
  try {
    const { assetAmount } = req.body;

    if (assetAmount === undefined || assetAmount === null) {
      return res.status(400).json({
        success: false,
        message: 'assetAmount is required',
      });
    }

    const result = ammService.sellAsset(assetAmount);

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

async function addLiquidity(req, res) {
  try {
    const { assetAmount, usdcAmount } = req.body;

    if (assetAmount === undefined || assetAmount === null) {
      return res.status(400).json({
        success: false,
        message: 'assetAmount is required',
      });
    }

    if (usdcAmount === undefined || usdcAmount === null) {
      return res.status(400).json({
        success: false,
        message: 'usdcAmount is required',
      });
    }

    const result = ammService.addLiquidity(assetAmount, usdcAmount);

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

async function removeLiquidity(req, res) {
  try {
    const { lpTokens } = req.body;

    if (lpTokens === undefined || lpTokens === null) {
      return res.status(400).json({
        success: false,
        message: 'lpTokens is required',
      });
    }

    const result = ammService.removeLiquidity(lpTokens);

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
  buyAsset,
  sellAsset,
  addLiquidity,
  removeLiquidity,
};
