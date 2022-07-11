import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connect, disconnect } from 'mongoose';
import {
  initializeUsers,
  testAuthenticationsFlow,
  testAuthenticationsSocialFlow,
} from './modules/authentications';
import { testCampaignFlow } from './modules/backoffices/campaign-flow.spec';
import { testStaffFlow } from './modules/backoffices/staff-flow.spec';
import {
  testCommentsFlow,
  testContentsFlow,
  testReplyCommentsFlow,
} from './modules/feeds';
import {
  testBlocksFlow,
  testFollowsFlow,
  testLikesFlow,
  testSyncSocialFlow,
  testUsersReporting,
  testUsersUpdateMobile,
} from './modules/users';
import { testUsersDeleteUser } from './modules/users/delete-user.spec';
import { testQuoteCastsFlow } from './modules/users/quotecasts-flow.spec';
import { testRecastsFlow } from './modules/users/recasts-flow.spec';
import {
  closeAuthenticationsModule,
  closeBackofficesModule,
  closeFeedsModule,
  closePagesModule,
  closeUsersModule,
  setupAuthenticationsModule,
  setupBackofficesModule,
  setupFeedsModule,
  setupPagesModule,
  setupUsersModule,
} from './setups';

describe('Castcle E2E Tests', () => {
  let mongoMemoryReplSet: MongoMemoryReplSet;

  beforeAll(async () => {
    mongoMemoryReplSet = await MongoMemoryReplSet.create();
    global.mongoUri = mongoMemoryReplSet.getUri();

    await connect(mongoMemoryReplSet.getUri('test'), {
      useFindAndModify: false,
      useNewUrlParser: true,
    });
    await setupAuthenticationsModule();
    await setupBackofficesModule();
    await initializeUsers();
    await setupUsersModule();
    await setupPagesModule();
    await setupFeedsModule();
  });

  afterAll(async () => {
    await closeAuthenticationsModule();
    await closeBackofficesModule();
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

    describe('- Quote Casts Flow', () => {
      testQuoteCastsFlow();
    });

    describe('- Recasts Flow', () => {
      testRecastsFlow();
    });

    describe('- Block Flow', () => {
      testBlocksFlow();
    });

    describe('- Delete User', () => {
      testUsersDeleteUser();
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

  describe('# Backoffices Microservice', () => {
    describe('- Staff Flow', () => {
      testStaffFlow();
    });

    describe('- Campaign Flow', () => {
      testCampaignFlow();
    });
  });
});
