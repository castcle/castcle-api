const fs = require('fs');
const { exclude: _, ...swcJestConfig } = JSON.parse(
  fs.readFileSync(
    `${__dirname.split('/').slice(0, -2).join('/')}/.swcrc`,
    'utf-8',
  ),
);

export default {
  displayName: 'logger',
  preset: '../../jest.preset.js',
  setupFiles: ['../../jest.setup.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/logger',
};
