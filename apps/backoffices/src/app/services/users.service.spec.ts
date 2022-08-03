import {
  BackofficeDatabaseModule,
  MockUserDetail,
  MockUserService,
} from '@castcle-api/database';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { BackOfficeMongooseForFeatures } from '../schemas';
import { UserBackofficeService } from './users.service';

describe('UserBackofficeService', () => {
  let service: UserBackofficeService;
  let mongod: MongoMemoryReplSet;
  let moduleRef: TestingModule;
  let generateUser: MockUserService;
  let mocksUsers: MockUserDetail[];

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    global.mongoUri = mongod.getUri();
    moduleRef = await Test.createTestingModule({
      imports: [BackofficeDatabaseModule, BackOfficeMongooseForFeatures],
      providers: [UserBackofficeService, MockUserService],
    }).compile();

    service = moduleRef.get(UserBackofficeService);
    generateUser = moduleRef.get<MockUserService>(MockUserService);

    mocksUsers = await generateUser.generateMockUsers(5);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should mock users have length 5', () => {
    expect(mocksUsers).toHaveLength(5);
  });

  describe('GetUsers', () => {
    it('should return total of users', async () => {
      const users = await service.getUsers({
        maxResults: 5,
        keyword: '',
        page: 0,
      });
      expect(users.totalUsers).toEqual(5);
      expect(users.users).toHaveLength(5);
    });

    it('should return users with limit only 2 users', async () => {
      const users = await service.getUsers({
        maxResults: 2,
        keyword: '',
        page: 0,
      });
      expect(users.users).toHaveLength(2);
    });
  });
});
