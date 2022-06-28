export default {
  displayName: 'e2e',
  preset: '../../jest.preset.js',
  setupFiles: ['../../jest.setup.ts'],
  coverageDirectory: '../../coverage/libs/e2e',
  testMatch: ['**/(*.)+(e2e-spec).ts'],
};
