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

global.console = { debug: jest.fn(), error: jest.fn(), log: jest.fn() } as any;
