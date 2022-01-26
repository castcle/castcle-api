import { getMongoOptions } from 'libs/database/src/lib/environment';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connect, disconnect } from 'mongoose';
import { initializeUsers } from './modules/authentications';
import { testUsersClaimAirdrop, testUsersReporting } from './modules/users';
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
    (getMongoOptions as jest.Mock).mockReturnValue({
      uri: mongoMemoryReplSet.getUri(),
    });

    await connect(mongoMemoryReplSet.getUri('test'));
    await setupAuthenticationsModule();
    await initializeUsers();
    closeAuthenticationsModule();
  });

  afterAll(async () => {
    await mongoMemoryReplSet.stop();
    await disconnect();
  });

  describe('# Users Microservice', () => {
    beforeAll(async () => {
      await setupUsersModule();
    });

    afterAll(() => {
      closeUsersModule();
    });

    describe('- Report User or Content', () => {
      testUsersReporting();
    });

    describe('- Claim Airdrop', () => {
      testUsersClaimAirdrop();
    });
  });
});
