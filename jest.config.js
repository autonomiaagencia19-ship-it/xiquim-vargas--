export default {
  testEnvironment: "<rootDir>/tests/isolated-environment.js",
  coverageDirectory: "./coverage",
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 20000,
  maxWorkers: 1
};
