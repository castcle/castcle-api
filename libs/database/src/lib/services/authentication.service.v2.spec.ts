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
import { EntityVisibility } from '../dtos';
import { QueueName } from '../models';
import { Account, AccountActivation, Credential } from '../schemas';
import {
  AuthenticationService,
  SignupRequirements,
} from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';
describe('Authentication Service', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: AuthenticationServiceV2;
  let serviceV1: AuthenticationService;
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
        AuthenticationServiceV2,
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

    service = app.get(AuthenticationServiceV2);
    serviceV1 = app.get(AuthenticationService);
    userService = app.get(UserService);
  });

  describe('#getExistedUserFromCastcleId', () => {
    let signupResult: AccountActivation;
    let createAccountResult: {
      accountDocument: Account;
      credentialDocument: Credential;
    };
    const newDeviceUUID = '83b696d7-320b-4402-a412-d9cee10fc6a3';

    beforeAll(async () => {
      createAccountResult = await serviceV1.createAccount({
        device: 'iPhone01',
        deviceUUID: newDeviceUUID,
        languagesPreferences: ['en', 'en'],
        header: {
          platform: 'iOs',
        },
      });
    });
    const signupRequirements: SignupRequirements = {
      displayId: 'people',
      displayName: 'People',
      email: 'sompopdude@dudedude.com',
      password: '2@HelloWorld',
    };
    beforeAll(async () => {
      signupResult = await serviceV1.signupByEmail(
        createAccountResult.accountDocument,
        {
          displayId: 'people',
          displayName: 'People',
          email: signupRequirements.email,
          password: signupRequirements.password,
        }
      );
    });
    it('should create an accountActivation', () => {
      expect(signupResult).toBeDefined();
    });
    it('should return exist user is null', async () => {
      const id = 'undefined';
      const findUser = await service.getExistedUserFromCastcleId(id);
      expect(findUser).toBeNull();
    });
    it('should return exist user not null', async () => {
      const id = 'people';
      const findUser = await service.getExistedUserFromCastcleId(id);
      expect(findUser).not.toBeNull();
    });
    it('should set statuses of user all to deleted', async () => {
      const id = 'people';
      const findUser = await service.getExistedUserFromCastcleId(id);
      findUser.visibility = EntityVisibility.Deleted;
      expect(findUser.visibility).toEqual(EntityVisibility.Deleted);
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(userService).toBeDefined();
  });
});
