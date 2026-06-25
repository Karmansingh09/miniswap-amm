const dotenv = require('dotenv');
const app = require('./src/app');

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`MiniSwap API server is running on port ${PORT}`);
});