const express = require('express');
const { quoteBuy, buyAsset, sellAsset, addLiquidity } = require('../controllers/ammController');

console.log("✅ ammRoutes loaded");

const router = express.Router();

router.post('/quote', quoteBuy);
router.post('/buy-asset', buyAsset);
router.post('/sell-asset', sellAsset);
router.post('/add-liquidity', addLiquidity);

module.exports = router;