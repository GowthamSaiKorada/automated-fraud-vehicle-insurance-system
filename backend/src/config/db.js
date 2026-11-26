const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let memoryServer = null;
let localPersistentMode = false;

async function flushDisk() {
  if (!localPersistentMode) return;
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().command({ fsync: 1 });
    }
  } catch {
    // ignore if closing
  }
}

// Register before models are compiled so every schema flushes to local disk when fallback is active
mongoose.plugin((schema) => {
  schema.post('save', flushDisk);
  schema.post('deleteOne', flushDisk);
  schema.post('deleteMany', flushDisk);
  schema.post('findOneAndUpdate', flushDisk);
});

function redactUri(uri) {
  return String(uri).replace(/\/\/([^:@]+):([^@]+)@/, '//$1:***@');
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vehicle_insurance_fraud';
  const allowFallback = (process.env.USE_MEMORY_DB_FALLBACK || 'true').toLowerCase() === 'true';

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    localPersistentMode = false;
    console.log(`[DB] Connected to MongoDB at ${redactUri(uri)}`);
    return { mode: 'mongodb', uri };
  } catch (err) {
    if (!allowFallback) {
      console.error('[DB] Failed to connect to MongoDB:', err.message);
      throw err;
    }

    const dbPath = process.env.LOCAL_MONGO_PATH
      ? path.resolve(process.env.LOCAL_MONGO_PATH)
      : path.resolve(process.cwd(), '.mongo_data');
    fs.mkdirSync(dbPath, { recursive: true });
    console.warn(`[DB] MongoDB unreachable (${err.message}).`);
    console.warn(`[DB] Using persistent local MongoDB storage at ${dbPath} so accounts and claims are preserved across restarts.`);

    const { MongoMemoryServer } = require('mongodb-memory-server');
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        memoryServer = await MongoMemoryServer.create({
          instance: {
            dbPath,
            storageEngine: 'wiredTiger',
          },
        });
        break;
      } catch (startErr) {
        if (attempt === 2) throw startErr;
        console.warn('[DB] Local MongoDB lock busy during restart, retrying in 1.5s...');
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    const memUri = memoryServer.getUri('vehicle_insurance_fraud');
    await mongoose.connect(memUri);
    localPersistentMode = true;
    await flushDisk();

    console.log(`[DB] Connected to persistent local MongoDB (db=vehicle_insurance_fraud)`);
    return { mode: 'local_persistent_fallback', uri: memUri };
  }
}

async function disconnectDatabase() {
  await flushDisk();
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop({ doCleanup: false });
    memoryServer = null;
    localPersistentMode = false;
  }
}

module.exports = { connectDatabase, disconnectDatabase };
