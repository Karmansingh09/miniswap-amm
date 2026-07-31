const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');

console.log("Type of app:", typeof app);
console.log("Has listen:", typeof app.listen);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`MiniSwap API server is running on port ${PORT}`);
});

setInterval(() => {
  console.log("Server heartbeat...");
}, 5000);