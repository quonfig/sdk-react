/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/jest.setup.ts"],
  testRegex: "(/__tests__/.*\\.)(test|spec)\\.[jt]sx?$",
  moduleNameMapper: {
    // Handle module aliases and resolve paths
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  // Support for ESM modules in Jest
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transformIgnorePatterns: ["node_modules/(?!(@reforge-com/javascript)/)"],
};
