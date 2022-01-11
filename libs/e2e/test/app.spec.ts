/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import { getMongoOptions } from 'libs/database/src/lib/environment';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { initializeUsers } from './modules/authentications';
import { testUsersReporting } from './modules/users';
import {
  closeAuthenticationsModule,
  closeUsersModule,
  setupAuthenticationsModule,
  setupUsersModule
} from './setups';

jest.mock('./variables');
jest.mock('cache-manager-redis-store', () => 'memory');
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 1 })
  })
}));

global.console = { debug: jest.fn(), error: jest.fn(), log: jest.fn() } as any;

describe('Castcle E2E Tests', () => {
  let mongoMemoryServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoMemoryServer = await MongoMemoryServer.create();

    (getMongoOptions as any) = () => ({
      uri: mongoMemoryServer.getUri()
    });

    await setupAuthenticationsModule();
    await initializeUsers();
    await closeAuthenticationsModule();
  });

  afterAll(async () => {
    await mongoMemoryServer.stop();
  });

  describe('Users Microservice', () => {
    beforeAll(async () => {
      await setupUsersModule();
    });

    afterAll(async () => {
      await closeUsersModule();
    });

    testUsersReporting();
  });
});
