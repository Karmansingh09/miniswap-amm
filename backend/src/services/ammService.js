const liquidityPool = require('../models/liquidityPool');

/**
 * Returns the current liquidity pool object.
 * @returns {Object} The singleton liquidity pool.
 */
function getPool() {
  return liquidityPool;
}

/**
 * Calculates the constant product for the current pool state.
 * @returns {number} The value of x * y.
 */
function getConstantProduct() {
  return liquidityPool.assetReserve * liquidityPool.usdcReserve;
}

/**
 * Calculates the current spot price of the asset in USDC.
 * @returns {number} The current spot price.
 */
function getSpotPrice() {
  return liquidityPool.usdcReserve / liquidityPool.assetReserve;
}

/**
 * Simulates buying assets from the pool using the constant product formula.
 * The pool state is not modified.
 *
 * @param {number} assetAmount - The amount of assets to buy.
 * @returns {Object} A quote object with trade details.
 * @throws {Error} If the input is invalid.
 */
function quoteBuy(assetAmount) {
  if (typeof assetAmount !== 'number' || !Number.isFinite(assetAmount)) {
    throw new Error('assetAmount must be a valid number');
  }

  if (assetAmount <= 0) {
    throw new Error('assetAmount must be greater than 0');
  }

  if (assetAmount >= liquidityPool.assetReserve) {
    throw new Error('assetAmount must be less than assetReserve');
  }

  const constantProduct = getConstantProduct();
  const currentSpotPrice = getSpotPrice();
  const newAssetReserve = liquidityPool.assetReserve - assetAmount;
  const newUsdcReserve = constantProduct / newAssetReserve;
  const usdcRequired = newUsdcReserve - liquidityPool.usdcReserve;
  const effectiveTradePrice = usdcRequired / assetAmount;
  const priceImpact = ((effectiveTradePrice - currentSpotPrice) / currentSpotPrice) * 100;

  return {
    assetAmount,
    usdcRequired,
    newAssetReserve,
    newUsdcReserve,
    priceImpact,
  };
}

/**
 * Buys assets from the pool and updates the singleton liquidity state.
 * @param {number} assetAmount - The amount of assets to buy.
 * @returns {Object} The trade details plus the updated pool state.
 */
function buyAsset(assetAmount) {
  const quote = quoteBuy(assetAmount);

  liquidityPool.assetReserve = quote.newAssetReserve;
  liquidityPool.usdcReserve = quote.newUsdcReserve;

  return {
    ...quote,
    updatedPool: liquidityPool,
  };
}

module.exports = {
  getPool,
  getConstantProduct,
  getSpotPrice,
  quoteBuy,
  buyAsset,
};