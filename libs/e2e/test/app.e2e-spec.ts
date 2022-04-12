import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connect, disconnect } from 'mongoose';
import {
  initializeUsers,
  testAuthenticationsFlow,
  testAuthenticationsSocialFlow,
} from './modules/authentications';
import {
  testSyncSocialFlow,
  testUsersReporting,
  testUsersUpdateMobile,
} from './modules/users';
import {
  closeAuthenticationsModule,
  closeUsersModule,
  setupAuthenticationsModule,
  setupUsersModule,
} from './setups';

describe('Castcle E2E Tests', () => {
  let mongoMemoryReplSet: MongoMemoryReplSet;

  beforeAll(async () => {
    mongoMemoryReplSet = await MongoMemoryReplSet.create();
    (global as any).mongoUri = mongoMemoryReplSet.getUri();

    await connect(mongoMemoryReplSet.getUri('test'));
    await setupAuthenticationsModule();
    await initializeUsers();
  });

  afterAll(async () => {
    await closeAuthenticationsModule();
    await mongoMemoryReplSet.stop();
    await disconnect();
  });

  describe('# Authentication Microservice', () => {
    describe('- Register Member Flow', () => {
      testAuthenticationsFlow();
    });

    describe('- Register Social Flow', () => {
      testAuthenticationsSocialFlow();
    });
  });

  describe('# Users Microservice', () => {
    beforeAll(async () => {
      await setupUsersModule();
    });

    afterAll(async () => {
      await closeUsersModule();
    });

    describe('- Report User or Content', () => {
      testUsersReporting();
    });

    describe('- Update Mobile', () => {
      testUsersUpdateMobile();
    });

    describe('- Social Sync Flow', () => {
      testSyncSocialFlow();
    });
  });
});
