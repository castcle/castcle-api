import { DatabaseModule } from '@castcle-api/database';
import { CastcleBackofficeMongooseModule } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { CreatedUser } from 'libs/testing/src/lib/testing.dto';
import { UserQuery } from '../models/users.dto';
import { BackOfficeMongooseForFeatures } from '../schemas';
import { UserBackofficeService } from './users.service';

describe('UserBackofficeService', () => {
  let service: UserBackofficeService;
  let moduleRef: TestingModule;
  let mocksUsers: CreatedUser[];

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CastcleBackofficeMongooseModule,
        DatabaseModule,
        BackOfficeMongooseForFeatures,
      ],
      providers: [UserBackofficeService],
    });

    service = moduleRef.get(UserBackofficeService);
    mocksUsers = await Promise.all(
      Array.from({ length: 5 }, () => moduleRef.createUser()),
    );
  });

  afterAll(() => {
    return moduleRef.close();
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
      } as UserQuery);
      expect(users.totalUsers).toEqual(5);
      expect(users.users).toHaveLength(5);
    });

    it('should return users with limit only 2 users', async () => {
      const users = await service.getUsers({
        maxResults: 2,
        keyword: '',
        page: 0,
      } as UserQuery);
      expect(users.users).toHaveLength(2);
    });
  });
});
