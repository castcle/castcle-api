jest.setTimeout(20_000);

jest.mock('@castcle-api/logger');
jest.mock('bull');
jest.mock('dotenv', () => ({ config: () => true }));
jest.mock('libs/environments/src/lib/factories', () => ({
  getBullModuleOptions: () => ({ redis: {} }),
  getCacheModuleOptions: () => ({ store: 'memory', ttl: 1000 }),
  getMongooseModuleOptions: () => ({
    uri: (global as any).mongoUri,
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }),
}));

jest.mock('link-preview-js', () => ({
  getLinkPreview: jest.fn().mockReturnValue({}),
}));

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 1 }),
  }),
}));

global.process.env = { NODE_ENV: global.process.env.NODE_ENV };
