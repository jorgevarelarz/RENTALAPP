import mongoose from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { startMongoMemoryServer } from "../../src/__tests__/utils/mongoMemoryServer";

let mongoServer: MongoMemoryServer | null = null;

export const connectDb = async () => {
  if (process.env.DEBUG_DB_CLEAN === 'true') {
    console.log('[connectDb] invoked', process.pid, process.env.JEST_WORKER_ID, 'state', mongoose.connection.readyState);
  }
  if (mongoose.connection.readyState === 0) {
    if (!mongoServer) {
      mongoServer = await startMongoMemoryServer();
      if (process.env.DEBUG_DB_CLEAN === 'true') {
        console.log('[connectDb] start MongoMemoryServer', process.pid, process.env.JEST_WORKER_ID);
      }
    }
    const uri = mongoServer.getUri();
    process.env.NODE_ENV = "test";
    process.env.ALLOW_UNVERIFIED = "true";
    process.env.TENANT_PRO_UPLOADS_KEY = process.env.TENANT_PRO_UPLOADS_KEY || 'a'.repeat(64);
    process.env.MONGO_URL = uri;
    if (process.env.DEBUG_DB_CLEAN === 'true') {
      console.log('[connectDb] connect', process.pid, process.env.JEST_WORKER_ID, uri);
    }
    await mongoose.connect(uri);
  }
};

export const disconnectDb = async () => {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

export const clearDb = async () => {
  // Debug: track when clearDb runs in parallel test workers
  if (process.env.DEBUG_DB_CLEAN === 'true') {
    console.log('[clearDb]', process.env.JEST_WORKER_ID, new Date().toISOString());
  }
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};
