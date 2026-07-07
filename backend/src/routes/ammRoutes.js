const express = require('express');
const { quoteBuy } = require('../controllers/ammController');

const router = express.Router();

router.post('/quote', quoteBuy);

module.exports = router;
