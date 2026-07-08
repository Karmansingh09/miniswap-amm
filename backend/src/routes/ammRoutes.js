const express = require('express');
const { quoteBuy } = require('../controllers/ammController');

console.log("✅ ammRoutes loaded");

const router = express.Router();

router.post('/quote', quoteBuy);

module.exports = router;