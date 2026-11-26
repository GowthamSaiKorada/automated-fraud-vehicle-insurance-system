require('dotenv').config();
const { connectDatabase, disconnectDatabase } = require('./config/db');
const app = require('./app');
const { seedDemoData } = require('./utils/seedDemoData');

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await connectDatabase();
    await seedDemoData();

    const server = app.listen(PORT, () => {
      console.log(`[Backend] Express API server running on http://127.0.0.1:${PORT}`);
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      server.close(async () => {
        await disconnectDatabase();
        if (signal === 'SIGUSR2') {
          process.kill(process.pid, 'SIGUSR2');
        } else {
          process.exit(0);
        }
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGUSR2', () => shutdown('SIGUSR2'));
  } catch (err) {
    console.error('[Backend] Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();
