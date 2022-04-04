jest.setTimeout(10_000);

jest.mock('@castcle-api/utils/clients');
jest.mock('@castcle-api/logger');
jest.mock('bull');
jest.mock('dotenv', () => ({ config: () => true }));
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: jest.fn() }),
}));

jest.mock('link-preview-js', () => ({
  getLinkPreview: jest.fn().mockReturnValue({}),
}));

global.process.env = { NODE_ENV: global.process.env.NODE_ENV };
