export default {
  displayName: 'e2e',
  preset: '../../jest.preset.js',
  setupFiles: ['../../jest.setup.ts'],
  coverageDirectory: '../../coverage/tests/e2e',
  testMatch: ['**/app.spec.ts'],
};
