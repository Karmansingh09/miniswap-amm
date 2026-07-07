const express = require('express');
const { quoteBuy, buyAsset } = require('../controllers/ammController');

console.log("✅ ammRoutes loaded");

const router = express.Router();

router.post('/quote', quoteBuy);
router.post('/buy-asset', buyAsset);

module.exports = router;