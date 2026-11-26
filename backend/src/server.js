require('dotenv').config();
const app = require('./app');
const { connectDatabase } = require('./config/db');
const { seedDemoData } = require('./utils/seedDemoData');

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await connectDatabase();
    await seedDemoData();

    app.listen(PORT, () => {
      console.log(`[Backend] Express API server running on http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error('[Backend] Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();
