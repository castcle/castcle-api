const fs = require('fs');
const { exclude: _, ...swcJestConfig } = JSON.parse(
  fs.readFileSync(
    `${__dirname.split('/').slice(0, -3).join('/')}/.swcrc`,
    'utf-8'
  )
);

module.exports = {
  displayName: 'utils-decorators',
  preset: '../../../jest.preset.ts',
  setupFiles: ['../../../jest.setup.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/libs/utils/decorators',
};
