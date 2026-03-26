require('dotenv').config();

const app = require('./app');
const { testConnection } = require('./config/db');
const { startMqttSubscriber } = require('./mqtt/subscriber');

const port = Number(process.env.PORT || 4000);

async function startServer() {
  await testConnection();
  startMqttSubscriber();

  app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
