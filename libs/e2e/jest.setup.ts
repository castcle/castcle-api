jest.setTimeout(30_000);

jest.mock('libs/logger/src');
jest.mock('libs/database/src/lib/environment');
jest.mock('cache-manager-redis-store', () => 'memory');
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 1 }),
  }),
}));

jest.mock('./test/variables/applications.variable', () => ({}));

global.console.debug = jest.fn();
global.console.error = jest.fn();
global.console.info = jest.fn();
global.console.log = jest.fn();
