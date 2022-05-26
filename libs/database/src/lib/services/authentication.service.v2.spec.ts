import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { FacebookClientMock } from 'libs/utils/clients/src/lib/facebook/facebook.client.spec';
import { GoogleClientMock } from 'libs/utils/clients/src/lib/google/google.client.spec';
import { TwilioClientMock } from 'libs/utils/clients/src/lib/twilio/twilio.client.spec';
import { TwitterClientMock } from 'libs/utils/clients/src/lib/twitter/twitter.client.spec';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  AnalyticService,
  AuthenticationService,
  AuthenticationServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { EntityVisibility } from '../dtos';
import { QueueName } from '../models';
import { Repository } from '../repositories';
import { Account, AccountActivationV1, Credential } from '../schemas';
import { SignupRequirements } from './authentication.service';
import { CampaignService } from './campaign.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';

describe('Authentication Service', () => {
  let mongod: MongoMemoryReplSet;
  let app: TestingModule;
  let service: AuthenticationServiceV2;
  let serviceV1: AuthenticationService;
  let userService: UserService;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        AnalyticService,
        AuthenticationServiceV2,
        AuthenticationService,
        UserService,
        ContentService,
        HashtagService,
        Repository,
        { provide: CampaignService, useValue: {} },
        { provide: FacebookClient, useValue: FacebookClientMock },
        { provide: GoogleClient, useValue: GoogleClientMock },
        { provide: TwitterClient, useValue: TwitterClientMock },
        { provide: TwilioClient, useValue: TwilioClientMock },
        { provide: Mailer, useValue: {} },
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

  describe('#guestLogin()', () => {
    it('should return accesstoken and refreshtoken after guestLogin', async () => {
      const tokenResponse = await service.guestLogin({
        device: 'iPhone01',
        deviceUUID: '83b696d7-320b-4402-a412-d9cee10fc6a3',
        languagesPreferences: ['en'],
        header: {
          platform: 'iOs',
        },
      });
      expect(tokenResponse.accessToken).toBeDefined();
      expect(tokenResponse.refreshToken).toBeDefined();
    });
  });

  describe('#Exist', () => {
    let signupResult: AccountActivationV1;
    let createAccountResult: {
      accountDocument: Account;
      credentialDocument: Credential;
    };
    const newDeviceUUID = '83b696d7-320b-4402-a412-d9cee10fc6a3';
    const signupRequirements: SignupRequirements = {
      displayId: 'people',
      displayName: 'People',
      email: 'sompopdude@dudedude.com',
      password: '2@HelloWorld',
    };

    beforeAll(async () => {
      createAccountResult = await serviceV1.createAccount({
        device: 'iPhone01',
        deviceUUID: newDeviceUUID,
        languagesPreferences: ['en', 'en'],
        header: {
          platform: 'iOs',
        },
      });

      signupResult = await serviceV1.signupByEmail(
        createAccountResult.accountDocument,
        {
          displayId: 'people',
          displayName: 'People',
          email: signupRequirements.email,
          password: signupRequirements.password,
        },
      );
    });

    describe('#getExistedUserFromCastcleId()', () => {
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

    describe('#getAccountFromEmail()', () => {
      it('should return null for non exist email in account', async () => {
        const testEmail = 'yotest@gmail.com';
        const result = await service.getAccountFromEmail(testEmail);
        expect(result).toBeNull();
      });

      it('should found an account that have email match', async () => {
        const newlyInsertEmail = `${Math.ceil(
          Math.random() * 1000,
        )}@testinsert.com`;
        const newAccount = new (service as any).repository.accountModel({
          email: newlyInsertEmail,
          password: 'sompop2@Hello',
          isGuest: true,
          preferences: {
            languages: ['en', 'en'],
          },
        });
        const newAccountResult = await newAccount.save();
        const result = await service.getAccountFromEmail(newlyInsertEmail);
        expect(result._id).toEqual(newAccountResult._id);
      });
    });

    afterAll(async () => {
      await app.close();
      await mongod.stop();
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
      expect(serviceV1).toBeDefined();
      expect(userService).toBeDefined();
    });
  });
});
