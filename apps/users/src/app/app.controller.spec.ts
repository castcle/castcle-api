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
  AdsService,
  AuthenticationService,
  CampaignService,
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  SocialProvider,
  SocialSyncService,
  UserService,
} from '@castcle-api/database';
import {
  CastcleIncludes,
  ContentsResponse,
  ContentType,
  SaveContentDto,
  ShortPayload,
  SocialSyncDto,
  UpdateUserDto,
  UserField,
  UserResponseDto,
} from '@castcle-api/database/dtos';
import { generateMockUsers, MockUserDetail } from '@castcle-api/database/mocks';
import {
  Account,
  Content,
  Credential,
  Engagement,
  User,
} from '@castcle-api/database/schemas';
import { Configs } from '@castcle-api/environments';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { TopicName, UserProducer } from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserController } from './app.controller';
import { UserSettingsDto } from './dtos';
import { SuggestionService } from './services/suggestion.service';

describe('AppController', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let appController: UserController;
  let service: UserService;
  let contentService: ContentService;
  let authService: AuthenticationService;
  let userCredential: Credential;
  let userAccount: Account;
  let socialSyncService: SocialSyncService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        BullModule.registerQueue(
          { name: TopicName.Campaigns },
          { name: TopicName.Users }
        ),
      ],
      controllers: [UserController],
      providers: [
        UserService,
        AuthenticationService,
        ContentService,
        UserProducer,
        HashtagService,
        SocialSyncService,
        CampaignService,
        SuggestionService,
        AdsService,
      ],
    }).compile();
    appController = app.get(UserController);
    service = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    socialSyncService = app.get<SocialSyncService>(SocialSyncService);
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
      }
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
        }
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
        { hasRelationshipExpansion: true }
      )) as unknown as UserResponseDto;
      expect(response).toBeDefined();
      expect(response.castcleId).toEqual(user.displayId);
      expect(response.email).toEqual(userAccount.email);
      expect(response.followed).toBeDefined();
      expect(response.blocking).toBeDefined();
      expect(response.blocked).toBeDefined();
    });
  });

  describe('updateMyData', () => {
    it('should update partial data from UpdateUserDto', async () => {
      const user = await service.getUserFromCredential(userCredential);
      expect((await user.toUserResponse()).dob).toBeNull();
      //check full response
      const updateDto = {
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
        updateDto
      );
      expect(responseFull.dob).toEqual(updateDto.dob);
      expect(responseFull.links).toEqual(updateDto.links);
      expect(responseFull.images).toBeDefined();
      expect(responseFull.overview).toEqual(updateDto.overview);
      const postReponse = await appController.getMyData({
        $credential: userCredential,
        $language: 'th',
      } as any);
      expect(postReponse).toEqual(responseFull);
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
          contentDtos[i]
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
          { hasRelationshipExpansion: false }
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
        5
      );
      expect(response.payload.length).toEqual(1);
      expect(response.payload[0].castcleId).toBeDefined();
      expect(response.payload[0].displayName).toBeDefined();
      expect(response.payload[0].followers).toBeDefined();
      expect(response.payload[0].following).toBeDefined();
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
        }
      );
    });
    it('should show all user following from the system', async () => {
      const followingResult = await appController.getUserFollowing(
        mocks[0].user.displayId,
        {
          $credential: mocks[0].credential,
          $language: 'th',
        } as any,
        undefined,
        undefined,
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        }
      );
      expect(followingResult.payload.length).toEqual(1);
      expect(followingResult.payload[0].castcleId).toEqual(
        mocks[1].user.displayId
      );
    });
  });
  describe('deleteMyData', () => {
    it('should remove user from User schema', async () => {
      await appController.deleteMyData(
        'email',
        {
          password: '1234AbcD',
        },
        {
          $credential: userCredential,
          $language: 'th',
        } as any
      );
      const user = await service.getUserFromCredential(userCredential);
      expect(user).toBeNull();
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
        appController.syncSocial(credentialGuest, defaultRequest)
      ).rejects.toEqual(new CastcleException(CastcleStatus.FORBIDDEN_REQUEST));
    });

    it('should return exception when get duplicate social sync', async () => {
      await expect(
        appController.syncSocial(credential, defaultRequest)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.SOCIAL_PROVIDER_IS_EXIST)
      );

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
        appController.syncSocial(newCredential, newRequest)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.SOCIAL_PROVIDER_IS_EXIST)
      );
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
        appController.syncSocial(credential, userRequest)
      ).rejects.toEqual(new CastcleException(CastcleStatus.FORBIDDEN_REQUEST));
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
          displayName: 'mock tw',
          avatar: 'www.twitter.com/mocktw',
          active: true,
        },
        facebook: {
          socialId: 'f89766',
          username: 'mockfb',
          displayName: 'mock fb',
          avatar: 'www.facebook.com/mockfb',
          active: true,
        },
        youtube: null,
        medium: null,
      };
      expect(result).toBeDefined();
      expect(result).toEqual(expectResult);
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
      await appController.updateSyncSocial(credential, request);
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
      await appController.deleteSyncSocial(credential, request);
      const userSync = await socialSyncService.getSocialSyncByUser(page);
      const result = userSync.find((x) => x.provider === request.provider);
      expect(result.active).toEqual(false);
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
        userCredential
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
        appController.updateUserSettings(credentialGuest, req)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_TYPE_MISMATCH,
          credentialGuest.$language
        )
      );
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
        appController.updateUserSettings(credentialGuest, req)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.FORBIDDEN_REQUEST,
          credentialGuest.$language
        )
      );
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
        }
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
        }
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
        newCredential
      );
      expect(result.payload.referencedCasts.id).toEqual(contentA._id);
      expect(result.includes).toBeDefined;
    });

    it('should exception when recast content same content', async () => {
      const newCredential = {
        $credential: mocksUsers[1].credential,
        $language: 'th',
      } as any;

      await expect(
        appController.recastContent(
          mocksUsers[1].user.displayId,
          contentA._id,
          newCredential
        )
      ).rejects.toEqual(new CastcleException(CastcleStatus.RECAST_IS_EXIST));
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
        credential
      );
      expect(result.payload.referencedCasts.id).toEqual(contentA._id);
      expect(result.includes).toBeDefined;
    });
  });
});
