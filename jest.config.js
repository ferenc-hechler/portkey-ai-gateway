/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', {
      tsconfig: './tsconfig.test.json',
      useESM: true,
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  testTimeout: 30000, // Set default timeout to 30 seconds
};