const express = require('express');
const { quoteBuy, buyAsset, sellAsset } = require('../controllers/ammController');

console.log("✅ ammRoutes loaded");

const router = express.Router();

router.post('/quote', quoteBuy);
router.post('/buy-asset', buyAsset);
router.post('/sell-asset', sellAsset);

module.exports = router;