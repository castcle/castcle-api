import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connect, disconnect } from 'mongoose';
import {
  initializeUsers,
  testAuthenticationsFlow,
  testAuthenticationsSocialFlow,
} from './modules/authentications';
import {
  testContentsFlow,
  testSyncSocialFlow,
  testUsersUpdateMobile,
} from './modules/users';
import { testFollowsFlow } from './modules/users/follows-flow.spec';
import { testUsersReporting } from './modules/users/reporting.spec';
import {
  closeAuthenticationsModule,
  closeContentsModule,
  closePagesModule,
  closeUsersModule,
  setupAuthenticationsModule,
  setupContentsModule,
  setupPagesModule,
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
    await setupUsersModule();
    await setupPagesModule();
    await setupContentsModule();
  });

  afterAll(async () => {
    await closeAuthenticationsModule();
    await closeUsersModule();
    await closePagesModule();
    await closeContentsModule();
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
    describe('- Report User or Content', () => {
      testUsersReporting();
    });

    describe('- Update Mobile', () => {
      testUsersUpdateMobile();
    });

    describe('- Social Sync Flow', () => {
      testSyncSocialFlow();
    });

    describe('- Follows Flow', () => {
      testFollowsFlow();
    });
  });

  describe('# Feeds Microservice', () => {
    describe('- Content Flow', () => {
      testContentsFlow();
    });
  });
});
