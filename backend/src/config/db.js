const mongoose = require('mongoose');

let memoryServer = null;

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vehicle_insurance_fraud';
  const allowFallback = (process.env.USE_MEMORY_DB_FALLBACK || 'true').toLowerCase() === 'true';

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3500 });
    console.log(`[DB] Connected to MongoDB at ${uri}`);
    return { mode: 'mongodb', uri };
  } catch (err) {
    if (!allowFallback) {
      console.error('[DB] Failed to connect to MongoDB:', err.message);
      throw err;
    }

    console.warn(`[DB] MongoDB unreachable (${err.message}). Starting in-memory MongoDB fallback for dev/demo...`);
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri();
    await mongoose.connect(memUri);
    console.log(`[DB] Connected to in-memory MongoDB at ${memUri}`);
    return { mode: 'memory_fallback', uri: memUri };
  }
}

async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDatabase, disconnectDatabase };
