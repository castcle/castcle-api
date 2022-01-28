jest.setTimeout(10_000);

jest.mock('bull');
jest.mock('cache-manager-redis-store', () => 'memory');
jest.mock('libs/database/src/lib/environment');
jest.mock('libs/logger/src');
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 1 }),
  }),
}));

jest.mock('./test/variables/applications.variable', () => ({}));
