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

/**
 * Sells assets into the pool and updates the singleton liquidity state.
 * Validation matches quoteBuy().
 * @param {number} assetAmount - The amount of assets to sell.
 * @returns {Object} The trade details plus the updated pool state.
 */
function sellAsset(assetAmount) {
  if (typeof assetAmount !== 'number' || !Number.isFinite(assetAmount)) {
    throw new Error('assetAmount must be a valid number');
  }

  if (assetAmount <= 0) {
    throw new Error('assetAmount must be greater than 0');
  }

  if (assetAmount >= liquidityPool.assetReserve) {
    throw new Error('assetAmount must be less than assetReserve');
  }

  const currentSpotPrice = getSpotPrice();
  const constantProduct = getConstantProduct();
  const newAssetReserve = liquidityPool.assetReserve + assetAmount;
  const newUsdcReserve = constantProduct / newAssetReserve;
  const usdcReceived = liquidityPool.usdcReserve - newUsdcReserve;
  const effectivePrice = usdcReceived / assetAmount;
  const priceImpact = ((currentSpotPrice - effectivePrice) / currentSpotPrice) * 100;

  liquidityPool.assetReserve = newAssetReserve;
  liquidityPool.usdcReserve = newUsdcReserve;

  return {
    assetAmount,
    usdcReceived,
    newAssetReserve,
    newUsdcReserve,
    priceImpact,
    updatedPool: liquidityPool,
  };
}

/**
 * Adds liquidity to the pool and mints LP tokens.
 * @param {number} assetAmount - The amount of asset tokens to add.
 * @param {number} usdcAmount - The amount of USDC to add.
 * @returns {Object} Liquidity add details plus the updated pool state.
 */
function addLiquidity(assetAmount, usdcAmount) {
  if (typeof assetAmount !== 'number' || !Number.isFinite(assetAmount) || assetAmount <= 0) {
    throw new Error('assetAmount must be a positive number');
  }

  if (typeof usdcAmount !== 'number' || !Number.isFinite(usdcAmount) || usdcAmount <= 0) {
    throw new Error('usdcAmount must be a positive number');
  }

  const previousAssetReserve = liquidityPool.assetReserve;
  const previousLpTokenSupply = liquidityPool.lpTokenSupply;
  const lpTokensMinted = (assetAmount / previousAssetReserve) * previousLpTokenSupply;

  liquidityPool.assetReserve += assetAmount;
  liquidityPool.usdcReserve += usdcAmount;
  liquidityPool.lpTokenSupply += lpTokensMinted;

  return {
    assetAmount,
    usdcAmount,
    lpTokensMinted,
    updatedPool: liquidityPool,
  };
}

/**
 * Removes liquidity from the pool and burns LP tokens.
 * @param {number} lpTokens - The amount of LP tokens to burn.
 * @returns {Object} Removal details plus the updated pool state.
 */
function removeLiquidity(lpTokens) {
  if (typeof lpTokens !== 'number' || !Number.isFinite(lpTokens) || lpTokens <= 0) {
    throw new Error('lpTokens must be a positive finite number');
  }

  if (lpTokens > liquidityPool.lpTokenSupply) {
    throw new Error('lpTokens cannot exceed lpTokenSupply');
  }

  const share = lpTokens / liquidityPool.lpTokenSupply;
  const assetReturned = liquidityPool.assetReserve * share;
  const usdcReturned = liquidityPool.usdcReserve * share;

  liquidityPool.assetReserve -= assetReturned;
  liquidityPool.usdcReserve -= usdcReturned;
  liquidityPool.lpTokenSupply -= lpTokens;

  return {
    lpTokensBurned: lpTokens,
    assetReturned,
    usdcReturned,
    updatedPool: liquidityPool,
  };
}

module.exports = {
  getPool,
  getConstantProduct,
  getSpotPrice,
  quoteBuy,
  buyAsset,
  sellAsset,
  addLiquidity,
  removeLiquidity,
};