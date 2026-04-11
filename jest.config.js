const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
  ...jestConfig,
  modulePathIgnorePatterns: ["<rootDir>/.localdevserver"],
  moduleNameMapper: {
    ...jestConfig.moduleNameMapper,
    "^lightning/flowSupport$": "<rootDir>/__mocks__/lightning/flowSupport.js"
  }
};
