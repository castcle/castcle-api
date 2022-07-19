/*
 * Copyright (c) 2021, Castcle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 3 only, as
 * published by the Free Software Foundation.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * version 3 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 3 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Castcle, 22 Phet Kasem 47/2 Alley, Bang Khae, Bangkok,
 * Thailand 10160, or visit www.castcle.com if you need additional information
 * or have any questions.
 */
import {
  Account,
  AdsBidType,
  AdsBoostStatus,
  AdsCampaign,
  AdsObjective,
  AdsPaymentMethod,
  AdsQuery,
  AdsRequestDto,
  AdsService,
  AdsStatus,
  AnalyticService,
  AuthenticationService,
  CampaignService,
  CastcleIncludes,
  Content,
  ContentService,
  ContentType,
  ContentsResponse,
  Credential,
  DataService,
  Engagement,
  HashtagService,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  NotificationSource,
  NotificationType,
  PageDto,
  QueueName,
  RankerService,
  SaveContentDto,
  ShortPayload,
  SocialProvider,
  SocialSync,
  SocialSyncDto,
  SocialSyncService,
  SocialSyncServiceV2,
  TAccountService,
  Transaction,
  UpdateUserDto,
  User,
  UserField,
  UserResponseDto,
  UserService,
  UserType,
  WalletShortcutService,
  WalletType,
  generateMockUsers,
} from '@castcle-api/database';
import { Configs } from '@castcle-api/environments';
import { Downloader } from '@castcle-api/utils/aws';
import { FacebookClient } from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { DownloaderMock } from 'libs/utils/aws/src/lib/downloader.spec';
import { FacebookClientMock } from 'libs/utils/clients/src/lib/facebook/facebook.client.spec';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { UserSettingsDto } from '../dtos';
import { SuggestionService } from '../services/suggestion.service';
import { UsersController } from './users.controller';

describe('AppController', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let appController: UsersController;
  let service: UserService;
  let contentService: ContentService;
  let authService: AuthenticationService;
  let userCredential: Credential;
  let userAccount: Account;
  let socialSyncService: SocialSyncService;
  let notifyService: NotificationService;
  let adsService: AdsService;
  let transactionModel: Model<Transaction>;

  beforeAll(async () => {
    const DownloaderProvider = {
      provide: Downloader,
      useClass: DownloaderMock,
    };

    const FacebookClientProvider = {
      provide: FacebookClient,
      useClass: FacebookClientMock,
    };

    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CacheModule.register(),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
      ],
      controllers: [UsersController],
      providers: [
        { provide: DataService, useValue: {} },
        UserService,
        AuthenticationService,
        ContentService,
        HashtagService,
        SocialSyncService,
        CampaignService,
        TAccountService,
        SuggestionService,
        AdsService,
        AnalyticService,
        NotificationService,
        DownloaderProvider,
        FacebookClientProvider,
        RankerService,
        SocialSyncServiceV2,
        Repository,
        WalletShortcutService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.CAMPAIGN),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get(UsersController);
    service = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    socialSyncService = app.get<SocialSyncService>(SocialSyncService);
    notifyService = app.get<NotificationService>(NotificationService);
    adsService = app.get<AdsService>(AdsService);
    transactionModel = app.get(getModelToken('Transaction'));

    const result = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th'],
    });
    const accountActivation = await authService.signupByEmail(
      result.accountDocument,
      {
        email: 'test@gmail.com',
        displayId: 'test1234',
        displayName: 'test',
        password: '1234AbcD',
      },
    );
    userAccount = await authService.verifyAccount(accountActivation);
    userCredential = result.credentialDocument;
    jest
      .spyOn(service, 'uploadUserInfo')
      .mockImplementation(async (body: UpdateUserDto) => {
        return {
          ...body,
          images: {
            avatar: Configs.DefaultAvatarImages,
            cover: Configs.DefaultAvatarCovers,
          },
        };
      });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('getMyData', () => {
    it('should return UserResponseDto of current credential', async () => {
      const response = await appController.getMyData({
        $credential: userCredential,
        $language: 'th',
      } as any);
      const user = await service.getUserFromCredential(userCredential);
      expect(response).toBeDefined();
      expect(response.castcleId).toEqual(user.displayId);
      expect(response.email).toEqual(userAccount.email);
      expect(response.passwordNotSet).toBeDefined();
      expect(response.linkSocial).toBeUndefined();
      expect(response.syncSocial).toBeUndefined();
    });

    it('should return UserResponseDto of current credential with userFileds', async () => {
      const response = await appController.getMyData(
        {
          $credential: userCredential,
          $language: 'th',
        } as any,
        {
          userFields: [UserField.LinkSocial, UserField.SyncSocial],
          hasRelationshipExpansion: false,
        },
      );
      const user = await service.getUserFromCredential(userCredential);
      expect(response).toBeDefined();
      expect(response.castcleId).toEqual(user.displayId);
      expect(response.email).toEqual(userAccount.email);
      expect(response.passwordNotSet).toBeDefined();
      expect(response.linkSocial).toBeDefined();
      expect(response.syncSocial).toBeDefined();
    });
  });

  describe('getUserById', () => {
    it('should return UserResponseDto of user id ', async () => {
      const user = await service.getUserFromCredential(userCredential);
      const response = (await appController.getUserById(
        user._id,
        {
          $credential: userCredential,
          $language: 'th',
        } as any,
        { hasRelationshipExpansion: true, userFields: [UserField.Casts] },
      )) as unknown as UserResponseDto;
      expect(response).toBeDefined();
      expect(response.castcleId).toEqual(user.displayId);
      expect(response.email).toEqual(userAccount.email);
      expect(response.followed).toBeDefined();
      expect(response.blocking).toBeDefined();
      expect(response.blocked).toBeDefined();
      expect(response.casts).toBeDefined();
    });
  });

  describe('updateMyData', () => {
    it('should update partial data from UpdateUserDto', async () => {
      const user = await service.getUserFromCredential(userCredential);
      expect((await user.toUserResponse()).dob).toBeNull();
      //check full response
      const updateDto = {
        dob: '1990-12-10T00:00:00.000Z',
        links: {
          facebook: 'http://facebook.com/abc',
          medium: 'https://medium.com/abc',
          website: 'https://djjam.app',
          youtube: 'https://youtube.com/abcdef',
        },
        images: {
          avatar: 'https://placehold.it/200x200',
          cover: 'https://placehold.it/1500x300',
        },
        overview: 'this is a test',
      } as UpdateUserDto;

      const responseFull = await appController.updateMyData(
        { $credential: userCredential, $language: 'th' } as any,
        'me',
        updateDto,
      );
      expect(responseFull.dob.toISOString()).toEqual(updateDto.dob);
      expect(responseFull.links).toEqual(updateDto.links);
      expect(responseFull.images).toBeDefined();
      expect(responseFull.overview).toEqual(updateDto.overview);
      const postResponse = await appController.getMyData({
        $credential: userCredential,
        $language: 'th',
      } as any);
      expect(postResponse).toEqual(responseFull);
    });

    it('should return Exception when update duplicate castcle id', async () => {
      const mocks = await generateMockUsers(1, 0, {
        accountService: authService,
        userService: service,
      });

      const updateDto = {
        castcleId: mocks[0].user.displayId,
        displayName: 'testDisplay01',
        dob: '1990-12-10T00:00:00.000Z',
        links: {
          facebook: 'http://facebook.com/abc',
          medium: 'https://medium.com/abc',
          website: 'https://djjam.app',
          youtube: 'https://youtube.com/abcdef',
        },
        images: {
          avatar: 'https://placehold.it/200x200',
          cover: 'https://placehold.it/1500x300',
        },
        overview: 'this is a test',
      } as UpdateUserDto;

      await expect(
        appController.updateMyData(
          { $credential: userCredential, $language: 'th' } as any,
          'me',
          updateDto,
        ),
      ).rejects.toEqual(new CastcleException('USER_ID_IS_EXIST'));
    });

    it('should update castcleid and dispalyname from UpdateUserDto', async () => {
      const updateDto = {
        castcleId: 'test01',
        displayName: 'testDisplay01',
        dob: '1990-12-10',
        links: {
          facebook: 'http://facebook.com/abc',
          medium: 'https://medium.com/abc',
          website: 'https://djjam.app',
          youtube: 'https://youtube.com/abcdef',
        },
        images: {
          avatar: 'https://placehold.it/200x200',
          cover: 'https://placehold.it/1500x300',
        },
        overview: 'this is a test',
      } as UpdateUserDto;

      const responseFull = await appController.updateMyData(
        { $credential: userCredential, $language: 'th' } as any,
        'me',
        updateDto,
      );
      expect(responseFull.castcleId).toEqual(updateDto.castcleId);
      expect(responseFull.displayName).toEqual(updateDto.displayName);

      const response = (await appController.getUserById(
        responseFull.id,
        {
          $credential: userCredential,
          $language: 'th',
        } as any,
        { hasRelationshipExpansion: true, userFields: [UserField.Casts] },
      )) as unknown as UserResponseDto;

      expect(response.canUpdateCastcleId).toEqual(false);
    });

    it('should return Exception when update block period', async () => {
      const updateDto = {
        castcleId: 'test01',
        displayName: 'testDisplay01',
        dob: '1990-12-10',
        links: {
          facebook: 'http://facebook.com/abc',
          medium: 'https://medium.com/abc',
          website: 'https://djjam.app',
          youtube: 'https://youtube.com/abcdef',
        },
        images: {
          avatar: 'https://placehold.it/200x200',
          cover: 'https://placehold.it/1500x300',
        },
        overview: 'this is a test',
      } as UpdateUserDto;

      await expect(
        appController.updateMyData(
          { $credential: userCredential, $language: 'th' } as any,
          'me',
          updateDto,
        ),
      ).rejects.toEqual(new CastcleException('CHANGE_CASTCLE_ID_FAILED'));
    });
  });

  describe('- Contents related', () => {
    let user: User;
    let contentDtos: SaveContentDto[];
    const contents: Content[] = [];
    let expectedResponse: ContentsResponse;
    beforeAll(async () => {
      user = await service.getUserFromCredential(userCredential);
      contentDtos = [
        {
          type: ContentType.Short,
          payload: {
            message: 'hello',
          } as ShortPayload,
          castcleId: user.displayId,
        },
        {
          type: ContentType.Short,
          payload: {
            message: 'hi',
          } as ShortPayload,
          castcleId: user.displayId,
        },
      ];
      const engagementContents: Engagement[][] = [];
      for (let i = 0; i < contentDtos.length; i++) {
        const newContent = await contentService.createContentFromUser(
          user,
          contentDtos[i],
        );
        engagementContents[i] = [
          await contentService.likeContent(newContent, user),
        ];
        contents.push(newContent);
      }
      expectedResponse = {
        payload: contents
          .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
          .map((c, index) => c.toContentPayloadItem(engagementContents[index])),
        includes: new CastcleIncludes({
          users: contents.map(({ author }) => author),
        }),
        meta: {
          resultCount: contents.length,
          oldestId: contents[contents.length - 1].id,
          newestId: contents[0].id,
        },
      };
      console.debug('liked stuff', JSON.stringify(expectedResponse));
    });
    describe('getMyContents', () => {
      it('should get all contents from current user credential', async () => {
        const response = await appController.getMyContents({
          $credential: userCredential,
          $language: 'th',
        } as any);
        //expect(response).toEqual(expectedResponse);
        expect(response.meta).toEqual(expectedResponse.meta);
      });
    });

    describe('getUserContents', () => {
      it('should get all contents from user id', async () => {
        const response = await appController.getUserContents(
          user._id,
          { $credential: userCredential, $language: 'th' } as any,
          { hasRelationshipExpansion: false },
        );
        expect(response.meta).toEqual(expectedResponse.meta);
      });
    });
  });

  describe('getMentions', () => {
    it('should get all mentions user form system', async () => {
      const response = await appController.getMentions(
        { $credential: userCredential } as any,
        '',
        1,
        5,
      );
      expect(response.payload.length).toEqual(2);
      expect(response.payload[0].castcleId).toBeDefined();
      expect(response.payload[0].displayName).toBeDefined();
      expect(response.payload[0].followers).toBeDefined();
      expect(response.payload[0].following).toBeDefined();
    });
  });

  describe('getMeMentions', () => {
    it('should get all mentions user form system', async () => {
      const response = await appController.getMeMentions(
        { $credential: userCredential } as any,
        '',
        {
          userFields: [UserField.Relationships],
          hasRelationshipExpansion: true,
        },
      );
      expect(response.payload.length).toEqual(2);
      expect(response.payload[0].castcleId).toBeDefined();
      expect(response.payload[0].displayName).toBeDefined();
      expect(response.payload[0].followers).toBeDefined();
      expect(response.payload[0].following).toBeDefined();
      expect(response.payload[0].blocking).toBeDefined();
      expect(response.payload[0].blocked).toBeDefined();
      expect(response.payload[0].followed).toBeDefined();
    });
  });

  describe('getUserFollowing', () => {
    let mocks: MockUserDetail[];
    beforeAll(async () => {
      mocks = await generateMockUsers(5, 2, {
        accountService: authService,
        userService: service,
      });

      await appController.follow(
        mocks[0].user.displayId,
        {
          $credential: mocks[0].credential,
          $language: 'th',
        } as any,
        {
          targetCastcleId: mocks[1].user._id,
        },
      );
    });
    it('should show all user following from the system', async () => {
      const followingResult = await appController.getUserFollowing(
        mocks[0].user.displayId,
        {
          $credential: mocks[0].credential,
          $language: 'th',
        } as any,
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        },
      );
      expect(followingResult.payload.length).toEqual(1);
      expect(followingResult.payload[0].castcleId).toEqual(
        mocks[1].user.displayId,
      );
      expect(followingResult.meta).toBeDefined();
    });

    it('should show all user follower from the system', async () => {
      const followerResult = await appController.getUserFollower(
        mocks[1].user.displayId,
        {
          $credential: mocks[0].credential,
          $language: 'th',
        } as any,
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        },
      );
      expect(followerResult.payload.length).toEqual(1);
      expect(followerResult.payload[0].castcleId).toEqual(
        mocks[0].user.displayId,
      );
      expect(followerResult.meta).toBeDefined();
    });
  });

  describe('deleteMyData', () => {
    it('should remove user from User schema', async () => {
      const user = await service.getUserFromCredential(userCredential);
      await appController.deleteMyData({ account: userAccount, user } as any, {
        channel: 'email',
        payload: { password: '1234AbcD' },
      });

      await expect(
        service.getUserFromCredential(userCredential),
      ).resolves.toBeNull();
    });
  });

  describe('syncSocial', () => {
    let user: User;
    let page: User;
    let credential;
    let defaultRequest: SocialSyncDto;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 1, {
        userService: service,
        accountService: authService,
      });

      user = mocksUsers[0].user;
      credential = {
        $credential: mocksUsers[0].credential,
        $language: 'th',
      } as any;

      page = mocksUsers[0].pages[0];

      defaultRequest = {
        castcleId: page.displayId,
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true,
      };
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should create sync social successful', async () => {
      await appController.syncSocial(credential, defaultRequest);
      const userSync = await socialSyncService.getSocialSyncByUser(page);

      expect(userSync.length).toEqual(1);
      expect(userSync[0].provider).toEqual(SocialProvider.Twitter);
    });

    it('should return Exception when get guest account', async () => {
      const guest = await authService.createAccount({
        device: 'iPhone8+',
        deviceUUID: 'ios8abc',
        header: { platform: 'ios' },
        languagesPreferences: ['th'],
        geolocation: {
          countryCode: '+66',
          continentCode: '+66',
        },
      });

      const credentialGuest = {
        $credential: guest.credentialDocument,
        $language: 'th',
      } as any;

      await expect(
        appController.syncSocial(credentialGuest, defaultRequest),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });

    it('should return exception when get duplicate social sync', async () => {
      await expect(
        appController.syncSocial(credential, defaultRequest),
      ).rejects.toEqual(new CastcleException('SOCIAL_PROVIDER_IS_EXIST'));

      const mocksNewUsers = await generateMockUsers(1, 1, {
        userService: service,
        accountService: authService,
      });

      const newPage = mocksNewUsers[0].pages[0];
      const newCredential = {
        $credential: mocksNewUsers[0].credential,
        $language: 'th',
      } as any;

      const newRequest: SocialSyncDto = {
        castcleId: newPage.displayId,
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true,
      };
      await expect(
        appController.syncSocial(newCredential, newRequest),
      ).rejects.toEqual(new CastcleException('SOCIAL_PROVIDER_IS_EXIST'));
    });

    it('should return exception when socail sync with user people', async () => {
      const userRequest: SocialSyncDto = {
        castcleId: user.displayId,
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true,
      };
      await expect(
        appController.syncSocial(credential, userRequest),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });

    it('should get all sync social from user', async () => {
      const request = {
        castcleId: page.displayId,
        provider: SocialProvider.Facebook,
        socialId: 'f89766',
        userName: 'mockfb',
        displayName: 'mock fb',
        avatar: 'www.facebook.com/mockfb',
        active: true,
      };
      await appController.syncSocial(credential, request);
      const result = await appController.getSyncSocial(credential);
      const expectResult = {
        twitter: {
          socialId: 't12345678',
          username: 'mocktw',
          provider: 'twitter',
          displayName: 'mock tw',
          avatar: 'www.twitter.com/mocktw',
          active: true,
          autoPost: true,
        },
        facebook: {
          socialId: 'f89766',
          username: 'mockfb',
          provider: 'facebook',
          displayName: 'mock fb',
          avatar: 'www.facebook.com/mockfb',
          active: true,
          autoPost: true,
        },
        youtube: null,
        medium: null,
      };
      expect(result).toBeDefined();
      expect(result['twitter']).toEqual(
        expect.objectContaining(expectResult.twitter),
      );
      expect(result['facebook']).toEqual(
        expect.objectContaining(expectResult.facebook),
      );
    });

    it('should get payload all sync social from user', async () => {
      const syncSocialResponse = await appController.getSyncSocialOfArray(
        credential,
      );

      expect(syncSocialResponse.payload).toHaveLength(2);
      expect(syncSocialResponse.payload?.length).toBeGreaterThan(0);
    });

    it('should update sync social successful', async () => {
      const request = {
        castcleId: page.displayId,
        provider: SocialProvider.Facebook,
        socialId: '56738393',
        userName: 'mockfb2',
        displayName: 'mock fb2',
        avatar: 'www.facebook.com/mockfb2',
        active: true,
      };
      await appController.updateSyncSocial(request);
      const userSync = await socialSyncService.getSocialSyncByUser(page);
      const result = userSync.find((x) => x.provider === request.provider);
      expect(result.socialId).toEqual(request.socialId);
      expect(result.userName).toEqual(request.userName);
      expect(result.displayName).toEqual(request.displayName);
      expect(result.avatar).toEqual(request.avatar);
    });

    it('should delete sync social successful', async () => {
      const request = {
        castcleId: page.displayId,
        provider: SocialProvider.Facebook,
        socialId: '56738393',
      };
      await appController.deleteSyncSocial(request);
      const userSync = await socialSyncService.getSocialSyncByUser(page);
      const result = userSync.find((x) => x.provider === request.provider);
      expect(result).toBeUndefined();
    });
  });

  describe('updateUserSettings', () => {
    it('should update perferred language from Account schema', async () => {
      const credentialGuest = {
        $credential: userCredential,
        $language: 'th',
      } as any;

      const req: UserSettingsDto = {
        preferredLanguages: ['th', 'en'],
      };
      await appController.updateUserSettings(credentialGuest, req);
      const account = await authService.getAccountFromCredential(
        userCredential,
      );
      expect(account.preferences.languages).toEqual(['th', 'en']);
    });

    it('should return Exception when empty language', async () => {
      const credentialGuest = {
        $credential: userCredential,
        $language: 'en',
      } as any;

      const req: UserSettingsDto = {
        preferredLanguages: [],
      };

      await expect(
        appController.updateUserSettings(credentialGuest, req),
      ).rejects.toEqual(new CastcleException('PAYLOAD_TYPE_MISMATCH'));
    });

    it('should return Exception when get guest account', async () => {
      const guest = await authService.createAccount({
        device: 'iPhone8+',
        deviceUUID: 'ios8abc',
        header: { platform: 'ios' },
        languagesPreferences: ['th'],
        geolocation: {
          countryCode: '+66',
          continentCode: '+66',
        },
      });

      const credentialGuest = {
        $credential: guest.credentialDocument,
        $language: 'en',
      } as any;

      const req: UserSettingsDto = {
        preferredLanguages: ['th', 'en'],
      };

      await expect(
        appController.updateUserSettings(credentialGuest, req),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });
  });

  describe('Referrer & Referee', () => {
    let user: User;
    let credential;
    let newAccount;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService,
      });

      user = mocksUsers[0].user;
      credential = {
        $credential: mocksUsers[0].credential,
        $language: 'th',
      } as any;

      newAccount = await authService.createAccount({
        deviceUUID: 'refTest12354',
        languagesPreferences: ['th', 'en'],
        header: {
          platform: 'ios',
        },
        device: 'iPhone',
      });
      //sign up to create actual account
      await authService.signupByEmail(newAccount.accountDocument, {
        displayId: 'ref1',
        displayName: 'ref01',
        email: 'ref1@gmail.com',
        password: 'test1234567',
        referral: user.displayId,
      });
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should get referrer from Account Referrer schema', async () => {
      const result = await appController.getReferrer('ref1', credential, {
        hasRelationshipExpansion: true,
      });
      expect(result.payload.castcleId).toEqual(user.displayId);
    });

    it('should get referrer from Account Referrer schema By ME', async () => {
      const meCredential = {
        $credential: newAccount.credentialDocument,
        $language: 'th',
      } as any;
      const result = await appController.getReferrer('me', meCredential, {
        hasRelationshipExpansion: true,
      });
      expect(result.payload.castcleId).toEqual(user.displayId);
    });

    it('should get empty data when use wrong referrer', async () => {
      const result = await appController.getReferrer(
        user.displayId,
        credential,
        {
          hasRelationshipExpansion: true,
        },
      );
      expect(result.payload).toBeNull();
    });

    it('should get Referee from Account Referrer schema', async () => {
      const newAccount2 = await authService.createAccount({
        deviceUUID: 'refTest789',
        languagesPreferences: ['th', 'en'],
        header: {
          platform: 'ios',
        },
        device: 'iPhone',
      });

      await authService.signupByEmail(newAccount2.accountDocument, {
        displayId: 'ref2',
        displayName: 'ref02',
        email: 'ref2@gmail.com',
        password: 'test1234567',
        referral: user.displayId,
      });

      const result = await appController.getReferee(
        user.displayId,
        credential,
        {
          hasRelationshipExpansion: true,
        },
      );
      expect(result.payload.length).toEqual(2);
    });

    it('should get Referee from Account Referrer schema By ME', async () => {
      const result = await appController.getReferee('me', credential, {
        hasRelationshipExpansion: true,
      });
      expect(result.payload.length).toEqual(2);
    });

    it('should get empty data when use wrong Referee', async () => {
      const result = await appController.getReferee('ref2', credential, {
        hasRelationshipExpansion: true,
      });
      expect(result.payload.length).toEqual(0);
    });
  });

  describe('RecastContent', () => {
    let user: User;
    let contentA: Content;
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(2, 0, {
        userService: service,
        accountService: authService,
      });

      user = mocksUsers[0].user;

      contentA = await contentService.createContentFromUser(user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should recast content successful', async () => {
      const newCredential = {
        $credential: mocksUsers[1].credential,
        $language: 'th',
      } as any;

      const result = await appController.recastContent(
        mocksUsers[1].user.displayId,
        contentA._id,
        newCredential,
      );
      expect(result.payload.referencedCasts.id).toEqual(contentA._id);
      expect(result.includes).toBeDefined;
    });

    it('should exception when recast content same content', async () => {
      const newCredential = {
        $credential: mocksUsers[1].credential,
        $language: 'th',
      } as any;

      const userOwner = await service.getByIdOrCastcleId(contentA.author.id);

      const notify = await notifyService.notifyToUser(
        {
          type: NotificationType.Recast,
          read: false,
          source: NotificationSource.Profile,
          sourceUserId: user._id,
          contentRef: contentA._id,
          account: userOwner.ownerAccount,
        },
        userOwner,
        'th',
      );

      expect(notify).toBeUndefined();

      await expect(
        appController.recastContent(
          mocksUsers[1].user.displayId,
          contentA._id,
          newCredential,
        ),
      ).rejects.toEqual(new CastcleException('RECAST_IS_EXIST'));
    });
  });

  describe('QuotecastContent', () => {
    let user: User;
    let credential;
    let contentA: Content;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService,
      });

      user = mocksUsers[0].user;
      credential = {
        $credential: mocksUsers[0].credential,
        $language: 'th',
      } as any;
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should recast content successful', async () => {
      const newUser = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService,
      });

      contentA = await contentService.createContentFromUser(newUser[0].user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: newUser[0].user.displayId,
      });

      const result = await appController.quoteContent(
        user.displayId,
        contentA._id,
        'this is good content',
        credential,
      );

      expect(result.payload.referencedCasts.id).toEqual(contentA._id);
      expect(result.includes).toBeDefined();
    });
  });

  describe('createPage', () => {
    const pageDto: PageDto = {
      displayName: 'test Page',
      castcleId: 'testPage',
    };
    beforeAll(async () => {
      const result = await authService.createAccount({
        device: 'iPhone',
        deviceUUID: 'iphone12345',
        header: { platform: 'iphone' },
        languagesPreferences: ['th', 'th'],
      });
      const accountActivation = await authService.signupByEmail(
        result.accountDocument,
        {
          email: 'test@gmail.com',
          displayId: 'test1234',
          displayName: 'test',
          password: '1234AbcD',
        },
      );
      userAccount = await authService.verifyAccount(accountActivation);
      userCredential = result.credentialDocument;
    });
    it('should create new user that has the info from pageDTO', async () => {
      const newPageResponse = await appController.createPage(
        { $credential: userCredential, $language: 'th' } as any,
        pageDto,
      );
      expect(newPageResponse.images.avatar).toBeDefined();
      expect(newPageResponse.displayName).toEqual(pageDto.displayName);
      expect(newPageResponse.images.cover).toBeDefined();
      expect(newPageResponse.castcleId).toEqual(pageDto.castcleId);
      const testPage = await service.getByIdOrCastcleId(pageDto.castcleId);
      const pageResponse = testPage.toPageResponse();
      expect(pageResponse.images.avatar).toBeDefined();
      expect(pageResponse.displayName).toEqual(pageDto.displayName);
      expect(pageResponse.images.cover).toBeDefined();
      expect(pageResponse.castcleId).toEqual(pageDto.castcleId);
    });
    afterAll(() => {
      authService._credentialModel.deleteMany({});
      authService._userModel.deleteMany({});
    });
  });

  describe('likeContent', () => {
    let content: Content;
    let contentId;
    let userMock: any;
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(2, 0, {
        userService: service,
        accountService: authService,
      });

      content = await contentService.createContentFromUser(mocksUsers[0].user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: mocksUsers[0].user.displayId,
      });
      userMock = mocksUsers[1].user;
      contentId = content.id;
    });

    it('should create like content', async () => {
      const content = await appController._getContentIfExist(contentId);

      const user = await appController._getUser(
        userMock.id,
        userMock.credential,
      );

      await contentService.likeContent(content, user);
      const userOwner = await service.getByIdOrCastcleId(content.author.id);

      const notify = await notifyService.notifyToUser(
        {
          type: NotificationType.Like,
          read: false,
          source: NotificationSource.Profile,
          sourceUserId: user._id,
          contentRef: content._id,
          account: userOwner.ownerAccount,
        },
        userOwner,
        'th',
      );

      expect(notify).toBeUndefined();

      const result = await contentService.getContentFromId(contentId);
      expect(result.engagements.like.count).toBe(1);
    });

    it('should create unlike content', async () => {
      const content = await appController._getContentIfExist(contentId);

      const user = await appController._getUser(
        userMock.id,
        userMock.credential,
      );

      await contentService.unLikeContent(content, user);

      const result = await contentService.getContentFromId(contentId);
      expect(result.engagements.like.count).toBe(0);
    });
    afterAll(() => {
      authService._userModel.deleteMany({});
      authService._accountModel.deleteMany({});
      authService._credentialModel.deleteMany({});
      contentService._contentModel.deleteMany({});
      (notifyService as any)._notificationModel.deleteMany({});
    });
  });

  describe('#getEngagementFromUser', () => {
    let content: Content | Content[];
    let mockUsers: MockUserDetail[];
    beforeAll(async () => {
      mockUsers = await generateMockUsers(3, 0, {
        userService: service,
        accountService: authService,
      });

      content = await contentService.createContentFromUser(mockUsers[0].user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: mockUsers[0].user.displayId,
      });
      await new contentService._engagementModel({
        type: 'like',
        user: mockUsers[1].user._id,
        account: mockUsers[1].user.ownerAccount,
        targetRef: {
          $ref: 'content',
          $id: content.id,
        },
        visibility: 'publish',
      }).save();
    });

    it('should get user liked content.', async () => {
      const response = await appController.getLikedCast(
        {
          $credential: mockUsers[2].credential,
          $language: 'th',
        } as any,
        mockUsers[1].user.id,
        {
          hasRelationshipExpansion: false,
          maxResults: 100,
          sinceId: null,
          untilId: null,
        },
      );

      expect(response.payload).toHaveLength(1);
      expect(response['includes'].users).toHaveLength(1);
      expect(response['meta'].resultCount).toBe(1);
      expect(String(response.payload[0].authorId)).toBe(
        String(mockUsers[0].user._id),
      );
      expect(response.payload[0].message).toBe(content['payload'].message);
    });

    afterAll(() => {
      service._userModel.deleteMany({});
      contentService._contentModel.deleteMany({});
      contentService._engagementModel.deleteMany({});
    });
  });

  describe('#listAds', () => {
    let mocks: MockUserDetail[];
    let content: Content;
    let mockAds: AdsCampaign;
    beforeAll(async () => {
      mocks = await generateMockUsers(2, 1, {
        accountService: authService,
        userService: service,
      });
      content = await contentService.createContentFromUser(mocks[0].user, {
        castcleId: mocks[0].pages[0].id,
        payload: {
          message: 'this is promote short',
        } as ShortPayload,
        type: ContentType.Short,
      });

      await new transactionModel({
        from: {
          type: WalletType.CASTCLE_TREASURY,
          value: 999999,
        },
        to: [
          {
            user: mocks[0].user,
            type: WalletType.ADS,
            value: 999999,
          },
        ],
      }).save();
      mockAds = await adsService.createAds(mocks[0].user, {
        campaignName: 'Ads',
        campaignMessage: 'This is ads',
        contentId: content.id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
      });
    });
    it('should be able to get list ads exist.', async () => {
      const adsResponse = await appController.listAds(
        { user: mocks[0].user as User } as Authorizer,
        {
          maxResults: 100,
          filter: 'week',
          timezone: '+07:00',
        } as AdsQuery,
      );

      expect(mockAds.adsRef).not.toBeUndefined();
      expect(adsResponse.payload?.length).toBeGreaterThan(0);
      expect(adsResponse.payload[0].campaignName).toBe(mockAds.detail.name);
      expect(adsResponse.payload[0].boostType).toBe('content');
      expect(adsResponse.payload[0].adStatus).toBe(mockAds.status);
      expect(adsResponse.payload[0].duration).toEqual(mockAds.detail.duration);
      expect(adsResponse.payload[0].dailyBudget).toEqual(
        mockAds.detail.dailyBudget,
      );
      expect(adsResponse.payload[0].campaignMessage).toBe(
        mockAds.detail.message,
      );
    });
    afterAll(() => {
      adsService._adsCampaignModel.deleteMany({});
      adsService._contentModel.deleteMany({});
    });
  });

  describe('#lookupAds', () => {
    let mocks: MockUserDetail[];
    let content: Content;
    let mockAds: AdsCampaign;
    beforeAll(async () => {
      mocks = await generateMockUsers(1, 1, {
        accountService: authService,
        userService: service,
      });
      content = await contentService.createContentFromUser(mocks[0].user, {
        castcleId: mocks[0].pages[0].id,
        payload: {
          message: 'this is promote short',
        } as ShortPayload,
        type: ContentType.Short,
      });

      await new transactionModel({
        from: {
          type: WalletType.CASTCLE_TREASURY,
          value: 999999,
        },
        to: [
          {
            user: mocks[0].user,
            type: WalletType.ADS,
            value: 999999,
          },
        ],
      }).save();
      mockAds = await adsService.createAds(mocks[0].user, {
        campaignName: 'Ads',
        campaignMessage: 'This is ads',
        contentId: content.id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
      });
    });
    it('should be able to lookup ads detail exist.', async () => {
      const adsResponse = await appController.lookupAds(
        { user: mocks[0].user as User } as Authorizer,
        mockAds._id,
      );

      expect(mockAds.adsRef).not.toBeUndefined();
      expect(adsResponse).toBeTruthy();
      expect(adsResponse.campaignName).toBe(mockAds.detail.name);
      expect(adsResponse.boostType).toBe('content');
      expect(adsResponse.adStatus).toBe(mockAds.status);
      expect(adsResponse.duration).toEqual(mockAds.detail.duration);
      expect(adsResponse.dailyBudget).toEqual(mockAds.detail.dailyBudget);
      expect(adsResponse.campaignMessage).toBe(mockAds.detail.message);
    });
    afterAll(() => {
      adsService._adsCampaignModel.deleteMany({});
      adsService._contentModel.deleteMany({});
    });
  });

  describe('createPage with social', () => {
    it('should create new user that has the info from SocialPageDto', async () => {
      const newPageResponse = await appController.createPageSocial(
        { $credential: userCredential, $language: 'th' } as any,
        {
          payload: [
            {
              provider: SocialProvider.Facebook,
              socialId: 'fb001',
              userName: 'fb_test1',
              displayName: 'test1',
              overview: 'facebook sync 1',
              avatar: '',
              cover: '',
              link: 'http://www.facebook.com/test1',
            },
            {
              provider: SocialProvider.Twitter,
              socialId: 'tw001',
              userName: 'tw_test1',
              displayName: 'test2',
              overview: 'twitter sync 1',
              avatar: '',
              cover: '',
              link: 'http://www.twitter.com/test2',
            },
          ],
        },
      );

      const page1 = await service.getByIdOrCastcleId(
        newPageResponse.payload[0].castcleId,
      );
      const page2 = await service.getByIdOrCastcleId(
        newPageResponse.payload[1].castcleId,
      );
      const syncSocial1 = await socialSyncService.getSocialSyncByUser(page1);
      const syncSocial2 = await socialSyncService.getSocialSyncByUser(page2);
      expect(newPageResponse.payload.length).toEqual(2);
      expect(newPageResponse.payload[0].links.facebook).toBeDefined();
      expect(newPageResponse.payload[0].socialSyncs).toBeDefined();
      expect(newPageResponse.payload[1].links.twitter).toBeDefined();
      expect(newPageResponse.payload[1].socialSyncs).toBeDefined();
      expect(syncSocial1.length).toEqual(1);
      expect(syncSocial2.length).toEqual(1);
      expect(syncSocial1[0].user).toEqual(page1._id);
      expect(syncSocial2[0].user).toEqual(page2._id);
    });

    it('should generate new user that has the duplicate info from SocialPageDto', async () => {
      const newPageResponse = await appController.createPageSocial(
        { $credential: userCredential, $language: 'th' } as any,
        {
          payload: [
            {
              provider: SocialProvider.Facebook,
              socialId: 'fb001',
              userName: 'fb_test1',
              displayName: 'test1',
              overview: 'facebook sync 1',
              avatar: '',
              cover: '',
              link: 'http://www.facebook.com/test1',
            },
            {
              provider: SocialProvider.Twitter,
              socialId: 'tw001',
              userName: 'tw_test1',
              displayName: 'test2',
              overview: 'twitter sync 1',
              avatar: '',
              cover: '',
              link: 'http://www.twitter.com/test2',
            },
          ],
        },
      );

      const page1 = await service.getByIdOrCastcleId(
        newPageResponse.payload[0].castcleId,
      );
      const page2 = await service.getByIdOrCastcleId(
        newPageResponse.payload[1].castcleId,
      );
      const syncSocial1 = await socialSyncService.getSocialSyncByUser(page1);
      const syncSocial2 = await socialSyncService.getSocialSyncByUser(page2);
      expect(newPageResponse.payload.length).toEqual(2);
      expect(newPageResponse.payload[0].links.facebook).toBeDefined();
      expect(newPageResponse.payload[0].socialSyncs).toBeDefined();
      expect(newPageResponse.payload[1].links.twitter).toBeDefined();
      expect(newPageResponse.payload[1].socialSyncs).toBeDefined();
      expect(syncSocial1.length).toEqual(1);
      expect(syncSocial2.length).toEqual(1);
      expect(syncSocial1[0].user).toEqual(page1._id);
      expect(syncSocial2[0].user).toEqual(page2._id);
    });

    it('should return Exception when use guest account', async () => {
      const guest = await authService.createAccount({
        device: 'iPhone8+',
        deviceUUID: 'ios8abc',
        header: { platform: 'ios' },
        languagesPreferences: ['th'],
        geolocation: {
          countryCode: '+66',
          continentCode: '+66',
        },
      });

      const credentialGuest = {
        $credential: guest.credentialDocument,
        $language: 'th',
      } as any;

      await expect(
        appController.createPageSocial(credentialGuest, {
          payload: [
            {
              provider: SocialProvider.Facebook,
              socialId: 'fb001',
              userName: 'fb_test1',
              displayName: 'test1',
              overview: 'facebook sync 1',
              avatar: '',
              cover: '',
              link: 'http://www.facebook.com/test1',
            },
          ],
        }),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });
  });

  describe('#getMyPages', () => {
    let credential;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 1, {
        userService: service,
        accountService: authService,
      });

      credential = {
        $credential: mocksUsers[0].credential,
        $language: 'th',
      } as any;

      const page = mocksUsers[0].pages[0];

      const defaultRequest = {
        castcleId: page.displayId,
        provider: SocialProvider.Facebook,
        socialId: 'fb999999',
        userName: 'mockfb9999',
        displayName: 'mock fb',
        avatar: 'www.fb.com/mockfb',
        active: true,
      };

      await appController.syncSocial(credential, defaultRequest);
    });

    it('should get page data with sync social successful', async () => {
      const result = await appController.getMyPages(credential);
      expect(result.payload).toBeDefined();
      expect(result.payload[0].syncSocial).toBeDefined();
    });
  });

  describe('#updateAds', () => {
    let mocks: MockUserDetail[];
    let mockAds: AdsCampaign;
    beforeAll(async () => {
      mocks = await generateMockUsers(2, 1, {
        accountService: authService,
        userService: service,
      });
      const adsInput: AdsRequestDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        castcleId: mocks[0].pages[0].id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
      };
      await new transactionModel({
        from: {
          type: WalletType.CASTCLE_TREASURY,
          value: 999999,
        },
        to: [
          {
            user: mocks[0].pages[0].id,
            type: WalletType.ADS,
            value: 999999,
          },
        ],
      }).save();
      mockAds = await adsService.createAds(mocks[0].pages[0], adsInput);
    });
    describe('#updateAds', () => {
      it('should be able update ads is correct.', async () => {
        const adsUpdate: AdsRequestDto = {
          campaignName: 'Ads update',
          campaignMessage: 'This is ads',
          dailyBudget: 10,
          duration: 5,
          objective: AdsObjective.Engagement,
          paymentMethod: AdsPaymentMethod.ADS_CREDIT,
          dailyBidType: AdsBidType.Auto,
        };
        await adsService.updateAdsById(mockAds.id, adsUpdate);
        const adsCampaign = await adsService._adsCampaignModel
          .findById(mockAds.id)
          .exec();

        expect(adsCampaign).toBeTruthy();
        expect(adsCampaign.detail.name).toEqual(adsUpdate.campaignName);
        expect(adsCampaign.detail.message).toEqual(adsUpdate.campaignMessage);
        expect(adsCampaign.detail.dailyBudget).toEqual(adsUpdate.dailyBudget);
        expect(adsCampaign.detail.duration).toEqual(adsUpdate.duration);
        expect(adsCampaign.objective).toEqual(adsUpdate.objective);
      });
    });
    describe('#adsRunning, #adsPause, #adsEnd', () => {
      let ads: AdsCampaign;
      it('should be able update ads running.', async () => {
        const adsInput: AdsRequestDto = {
          campaignName: 'Ads2',
          campaignMessage: 'This is ads2',
          castcleId: mocks[0].pages[0].id,
          dailyBudget: 1,
          duration: 5,
          objective: AdsObjective.Engagement,
          paymentMethod: AdsPaymentMethod.ADS_CREDIT,
          dailyBidType: AdsBidType.Auto,
        };
        ads = await adsService.createAds(mocks[0].pages[0], adsInput);
        await adsService._adsCampaignModel.updateOne(
          { _id: ads._id },
          {
            $set: {
              status: AdsStatus.Approved,
              boostStatus: AdsBoostStatus.Pause,
            },
          },
        );
        await appController.adsRunning(
          { credential: mocks[0].credential, user: mocks[0].user } as any,
          ads._id,
        );
        const adsCampaign = await adsService._adsCampaignModel
          .findById(ads.id)
          .exec();

        expect(adsCampaign).toBeTruthy();
        expect(adsCampaign.boostStatus).toEqual(AdsBoostStatus.Running);
      });
      it('ads running should return Exception when get wrong boost status.', async () => {
        await expect(
          appController.adsRunning(
            { credential: mocks[0].credential, user: mocks[0].user } as any,
            ads._id,
          ),
        ).rejects.toEqual(new CastcleException('ADS_BOOST_STATUS_MISMATCH'));
      });
      it('should be able update ads Pause.', async () => {
        await appController.adsPause(
          { credential: mocks[0].credential, user: mocks[0].user } as any,
          ads._id,
        );
        const adsCampaign = await adsService._adsCampaignModel
          .findById(ads.id)
          .exec();

        expect(adsCampaign).toBeTruthy();
        expect(adsCampaign.boostStatus).toEqual(AdsBoostStatus.Pause);
      });
      it('ads Pause should return Exception when get wrong boost status.', async () => {
        await expect(
          appController.adsPause(
            { credential: mocks[0].credential, user: mocks[0].user } as any,
            ads._id,
          ),
        ).rejects.toEqual(new CastcleException('ADS_BOOST_STATUS_MISMATCH'));
      });
      it('should be able update ads End.', async () => {
        await appController.adsEnd(
          { credential: mocks[0].credential, user: mocks[0].user } as any,
          ads._id,
        );
        const adsCampaign = await adsService._adsCampaignModel
          .findById(ads.id)
          .exec();

        expect(adsCampaign).toBeTruthy();
        expect(adsCampaign.boostStatus).toEqual(AdsBoostStatus.End);
      });
      it('ads End should return Exception when get wrong boost status.', async () => {
        await expect(
          appController.adsEnd(
            { credential: mocks[0].credential, user: mocks[0].user } as any,
            ads._id,
          ),
        ).rejects.toEqual(new CastcleException('ADS_BOOST_STATUS_MISMATCH'));
      });
    });

    describe('#deleteAds', () => {
      it('should be able delete ads is correct.', async () => {
        await adsService.deleteAdsById(mockAds.id);
        const adsCampaign = await adsService._adsCampaignModel
          .findById(mockAds.id)
          .exec();

        expect(adsCampaign).toBeNull();
      });
    });
    afterAll(() => {
      adsService._adsCampaignModel.deleteMany({});
      adsService._contentModel.deleteMany({});
    });
  });

  describe('#updateAutoPost', () => {
    let mocksPage: User;
    let mockSocialSync: SocialSync;
    beforeAll(async () => {
      mocksPage = await new (socialSyncService as any).userModel({
        ownerAccount: userCredential.account._id,
        displayName: 'mock user',
        displayId: 'mockid',
        type: UserType.PAGE,
      }).save();
      const socialSyncDto: SocialSyncDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true,
      };
      mockSocialSync = await socialSyncService.create(mocksPage, socialSyncDto);
    });
    it('should update auto post is exist.', async () => {
      await appController.updateAutoPost(
        { credential: userCredential } as any,
        mockSocialSync._id,
      );
      const social = await socialSyncService.getSocialSyncBySocialId(
        mockSocialSync._id,
      );

      expect(social.autoPost).toEqual(true);
      expect(social.socialId).toEqual(mockSocialSync.socialId);
      expect(social.userName).toEqual(mockSocialSync.userName);
      expect(social.displayName).toEqual(mockSocialSync.displayName);
    });
  });

  describe('#deleteAutoPost', () => {
    let mocksPage: User;
    let mockSocialSync: SocialSync;
    beforeAll(async () => {
      mocksPage = await new (socialSyncService as any).userModel({
        ownerAccount: userCredential.account._id,
        displayName: 'mock user',
        displayId: 'mockid',
        type: UserType.PAGE,
      }).save();
      const socialSyncDto: SocialSyncDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true,
      };
      mockSocialSync = await socialSyncService.create(mocksPage, socialSyncDto);
    });
    it('should delete auto post is exist.', async () => {
      await appController.updateAutoPost(
        { credential: userCredential } as any,
        mockSocialSync._id,
      );
      const social = await socialSyncService.getSocialSyncBySocialId(
        mockSocialSync._id,
      );

      expect(social.autoPost).toEqual(true);
      expect(social.socialId).toEqual(mockSocialSync.socialId);
      expect(social.userName).toEqual(mockSocialSync.userName);
      expect(social.displayName).toEqual(mockSocialSync.displayName);
    });
  });

  describe('#deleteAutoPost', () => {
    let mocksPage: User;
    let mockSocialSync: SocialSync;
    beforeAll(async () => {
      mocksPage = await new (socialSyncService as any).userModel({
        ownerAccount: userCredential.account._id,
        displayName: 'mock user',
        displayId: 'mockid',
        type: UserType.PAGE,
      }).save();
      const socialSyncDto: SocialSyncDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true,
      };
      mockSocialSync = await socialSyncService.create(mocksPage, socialSyncDto);
    });
    it('should delete auto post is exist.', async () => {
      await appController.updateAutoPost(
        { credential: userCredential } as any,
        mockSocialSync._id,
      );
      const social = await socialSyncService.getSocialSyncBySocialId(
        mockSocialSync._id,
      );

      expect(social.autoPost).toEqual(true);
      expect(social.socialId).toEqual(mockSocialSync.socialId);
      expect(social.userName).toEqual(mockSocialSync.userName);
      expect(social.displayName).toEqual(mockSocialSync.displayName);
    });
  });

  describe('#connectSyncSocial', () => {
    let mocksPage: User;
    let user: User;
    let mockSocialSync: SocialSync;
    beforeAll(async () => {
      mocksPage = await new (socialSyncService as any).userModel({
        ownerAccount: userCredential.account._id,
        displayName: 'mock user',
        displayId: 'mockid',
        type: UserType.PAGE,
      }).save();

      user = await new (socialSyncService as any).userModel({
        ownerAccount: userCredential.account._id,
        displayName: 'mock user',
        displayId: 'mockid',
        type: UserType.PEOPLE,
      }).save();
      const socialSyncDto: SocialSyncDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: false,
        autoPost: false,
      };
      mockSocialSync = await socialSyncService.create(mocksPage, socialSyncDto);
    });
    it('should update sync social is correct.', async () => {
      const payloadSyncSocial = {
        userName: 'reconnect sync social',
        displayName: 'reconnect123',
        overview: 'reconnect sync social',
        socialId: '123456789',
      } as SocialSyncDto;

      await appController.connectSyncSocial(
        { credential: userCredential, user: user } as any,
        mockSocialSync._id,
        payloadSyncSocial,
      );

      const social = await (socialSyncService as any).getSocialSyncBySocialId(
        mockSocialSync._id,
      );
      expect(social.autoPost).toEqual(true);
      expect(social.active).toEqual(true);
      expect(social.socialId).toEqual(payloadSyncSocial.socialId);
      expect(social.userName).toEqual(payloadSyncSocial.userName);
      expect(social.displayName).toEqual(payloadSyncSocial.displayName);
    });
  });

  describe('#disconnectSyncSocial', () => {
    let mocksPage: User;
    let user: User;
    let mockSocialSync: SocialSync;
    beforeAll(async () => {
      mocksPage = await new (socialSyncService as any).userModel({
        ownerAccount: userCredential.account._id,
        displayName: 'mock user',
        displayId: 'mockid',
        type: UserType.PAGE,
      }).save();

      user = await new (socialSyncService as any).userModel({
        ownerAccount: userCredential.account._id,
        displayName: 'mock user',
        displayId: 'mockid',
        type: UserType.PEOPLE,
      }).save();
      const socialSyncDto: SocialSyncDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: false,
        autoPost: false,
      };
      mockSocialSync = await socialSyncService.create(mocksPage, socialSyncDto);
    });
    it('should update sync social is correct.', async () => {
      await appController.disconnectSyncSocial(
        { credential: userCredential, user: user } as any,
        mockSocialSync._id,
      );

      const social = await socialSyncService.getSocialSyncBySocialId(
        mockSocialSync._id,
      );
      expect(social.autoPost).toEqual(false);
      expect(social.active).toEqual(false);
    });
  });
});
