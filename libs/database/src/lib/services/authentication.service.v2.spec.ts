import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AuthenticationServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { QueueName } from '../models';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';

describe('Authentication Service', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: AuthenticationServiceV2;
  let userService: UserService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        AuthenticationService,
        UserService,
        ContentService,
        HashtagService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = app.get(AuthenticationService);
    userService = app.get(UserService);
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(userService).toBeDefined();
  });

  describe('#getAccountFromEmail', () => {
    it('should return exist email', async () => {
      const email = 'testundefinedEmail';

      const findUser = await service.getAccountFromEmail(email);

      expect(findUser).toBeNull();
    });
  });
});
