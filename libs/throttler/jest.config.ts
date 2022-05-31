const fs = require('fs');
const { exclude: _, ...swcJestConfig } = JSON.parse(
  fs.readFileSync(
    `${__dirname.split('/').slice(0, -2).join('/')}/.swcrc`,
    'utf-8',
  ),
);

export default {
  displayName: 'throttler',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/throttler',
};
