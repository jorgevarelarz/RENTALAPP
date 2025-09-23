import mongoose from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { startMongoMemoryServer } from "../../src/__tests__/utils/mongoMemoryServer";

let mongoServer: MongoMemoryServer | null = null;

export const connectDb = async () => {
  if (mongoose.connection.readyState === 0) {
    if (!mongoServer) {
      mongoServer = await startMongoMemoryServer();
    }
    const uri = mongoServer.getUri();
    process.env.NODE_ENV = "test";
    process.env.ALLOW_UNVERIFIED = "true";
    process.env.TENANT_PRO_UPLOADS_KEY = process.env.TENANT_PRO_UPLOADS_KEY || 'a'.repeat(64);
    process.env.MONGO_URL = uri;
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
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};
