jest.setTimeout(20_000);

jest.mock('bull');
jest.mock('libs/environments/src/lib/factories', () => ({
  getBullModuleOptions: () => ({ redis: {} }),
  getCacheModuleOptions: () => ({ store: 'memory', ttl: 1000 }),
  getMongooseModuleOptions: () => ({
    uri: global.mongoUri,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }),
  getMongooseBackofficeModuleOptions: () => ({
    uri: global.mongoUri,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }),
  getMongooseBackofficeAppModuleOptions: () => ({
    uri: global.mongoUri,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }),
}));

jest.mock('libs/common/src/lib/logger', () => ({
  CastcleLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    time: jest.fn(),
    timeEnd: jest.fn(),
    warn: jest.fn(),
  })),
}));

jest.mock('libs/utils/clients/src/lib/ip-api/client', () => ({
  IpAPI: jest.fn(() => ({
    getGeolocation: jest.fn(),
  })),
}));

jest.mock('link-preview-js', () => ({
  getLinkPreview: jest.fn().mockReturnValue({}),
}));

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 1 }),
  }),
}));

jest.mock('twitter-api-v2');

process.env = { NODE_ENV: global.process.env.NODE_ENV };
