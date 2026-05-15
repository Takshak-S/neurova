import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// mongodb-memory-server spins up a real MongoDB process in memory.
// No Docker required. No test data bleeds into your real database.
// Each test suite gets a fresh, isolated database.

let mongoServer: MongoMemoryServer;

// Call in beforeAll() of each integration test suite
export const connectTestDB = async (): Promise<void> => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
};

//Call in AfterAll() of each integration test suite
export const disconnectTestDB = async (): Promise<void> => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
};

// Call in afterEach() to reset state between tests
// Prevents test order from affecting results
export const clearTestDB = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};