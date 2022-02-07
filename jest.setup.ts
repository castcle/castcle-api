jest.setTimeout(10_000);

jest.mock('@castcle-api/logger');
jest.mock('@castcle-api/utils/queue');
jest.mock('bull');
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: jest.fn() }),
}));

jest.mock('link-preview-js', () => ({
  getLinkPreview: jest.fn().mockReturnValue({}),
}));
