import { getMongoOptions } from 'libs/database/src/lib/environment';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { initializeUsers } from './modules/authentications';
import { testUsersReporting } from './modules/users';
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
    // (getMongoOptions as any) = () => ({ uri: mongoMemoryReplSet.getUri() });

    await setupAuthenticationsModule();
    await initializeUsers();
    closeAuthenticationsModule();
  });

  afterAll(async () => {
    await mongoMemoryReplSet.stop();
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
  });
});
