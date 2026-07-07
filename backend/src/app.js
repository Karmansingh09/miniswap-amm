const express = require('express');
const cors = require('cors');
const ammRoutes = require('./routes/ammRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', ammRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'MiniSwap API is running 🚀',
  });
});

module.exports = app;