import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connect, disconnect } from 'mongoose';
import {
  initializeUsers,
  testAuthenticationsFlow,
  testAuthenticationsSocialFlow,
} from './modules/authentications';
import {
  testCommentsFlow,
  testContentsFlow,
  testReplyCommentsFlow,
} from './modules/feeds';
import {
  testFollowsFlow,
  testLikesFlow,
  testSyncSocialFlow,
  testUsersReporting,
  testUsersUpdateMobile,
} from './modules/users';
import {
  closeAuthenticationsModule,
  closeFeedsModule,
  closePagesModule,
  closeUsersModule,
  setupAuthenticationsModule,
  setupFeedsModule,
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
    await setupFeedsModule();
  });

  afterAll(async () => {
    await closeAuthenticationsModule();
    await closeUsersModule();
    await closePagesModule();
    await closeFeedsModule();
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

    describe('- Like Flow', () => {
      testLikesFlow();
    });
  });

  describe('# Feeds Microservice', () => {
    describe('- Content Flow', () => {
      testContentsFlow();
    });

    describe('- Comment Flow', () => {
      testCommentsFlow();
    });

    describe('- Reply Comment Flow', () => {
      testReplyCommentsFlow();
    });
  });
});
