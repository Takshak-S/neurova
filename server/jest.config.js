/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["<rootDir>/src/__tests__/helpers/setup.ts"],
  // Increase timeout for integration tests that spin up MongoDB in memory
  testTimeout: 30000,
  // Don't run tests in parallel — integration tests share the in-memory DB
  maxWorkers: 1,
  verbose: true,
};
