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

import { CastcleBullModule, Environment } from '@castcle-api/environments';
import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  AdsService,
  AnalyticService,
  AuthenticationServiceV2,
  CampaignService,
  DataService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  RankerService,
  SuggestionServiceV2,
  TAccountService,
  UserService,
  UserServiceV2,
} from '../database.module';
import { PaginationQuery, QRCodeImageSize } from '../dtos';
import { MockUserService } from '../mocks';
import { MockUserDetail } from '../mocks/user.mocks';
import { KeywordType, QueueName } from '../models';
import { Repository } from '../repositories';
import { Account, Credential, User } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { CommentService } from './comment.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';

describe('UserServiceV2', () => {
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let accountDemo: any;
  let authService: AuthenticationService;
  let authServiceV2: AuthenticationServiceV2;
  let dataService: DataService;
  let generateUser: MockUserService;
  let guestDemo: {
    accountDocument: Account;
    credentialDocument: Credential;
  };
  let repository: Repository;
  let suggestServiceV2: SuggestionServiceV2;
  let userDemo: User;
  let userServiceV2: UserServiceV2;
  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        CastcleBullModule,
        HttpModule,
        MongooseAsyncFeatures,
        MongooseForFeatures,
        MongooseModule.forRoot(mongod.getUri()),
      ],
      providers: [
        AdsService,
        AnalyticService,
        AuthenticationService,
        AuthenticationServiceV2,
        CommentService,
        ContentService,
        DataService,
        HashtagService,
        MockUserService,
        NotificationServiceV2,
        RankerService,
        Repository,
        SuggestionServiceV2,
        TAccountService,
        UserService,
        UserServiceV2,
        { provide: CampaignService, useValue: {} },
        { provide: FacebookClient, useValue: {} },
        { provide: GoogleClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        { provide: TwilioClient, useValue: {} },
        { provide: Mailer, useValue: { sendRegistrationEmail: jest.fn() } },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
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

    generateUser = moduleRef.get(MockUserService);
    dataService = moduleRef.get<DataService>(DataService);
    suggestServiceV2 = moduleRef.get<SuggestionServiceV2>(SuggestionServiceV2);
    userServiceV2 = moduleRef.get<UserServiceV2>(UserServiceV2);
    dataService = moduleRef.get<DataService>(DataService);
    repository = moduleRef.get<Repository>(Repository);
    authService = moduleRef.get<AuthenticationService>(AuthenticationService);
    authServiceV2 = moduleRef.get<AuthenticationServiceV2>(
      AuthenticationServiceV2,
    );
    suggestServiceV2 = moduleRef.get<SuggestionServiceV2>(SuggestionServiceV2);
    guestDemo = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'ifong',
    });
    accountDemo = await authService.signupByEmail(guestDemo.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567',
    });

    userDemo = await authService.getUserFromAccount(accountDemo.account);
  });

  afterAll(async () => {
    await Promise.all([moduleRef.close(), mongod.stop()]);
    jest.spyOn(dataService, 'getFollowingSuggestions').mockRestore();
  });

  describe('#getUserRelationships', () => {
    let user1: User;
    let user2: User;
    beforeAll(async () => {
      const mocksUsers = await generateUser.generateMockUsers(2, 10);

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to block is not found', async () => {
      await userServiceV2.blockUser(user2, String(user1._id));
      const blocking = await userServiceV2.getUserRelationships(user1, true);

      expect(blocking).toHaveLength(1);
      expect(blocking).toContainEqual(user2._id);
    });
  });

  describe('#blockUser', () => {
    let user1: User;
    let user2: User;
    beforeAll(async () => {
      const mocksUsers = await generateUser.generateMockUsers(2, 10);

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;

      await userServiceV2.blockUser(user1, String(user2._id));
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to block is not found', async () => {
      await expect(userServiceV2.blockUser(user1, 'undefined')).rejects.toThrow(
        new CastcleException('USER_OR_PAGE_NOT_FOUND'),
      );
    });

    it('should return blocked lookup user', async () => {
      const relationship = await userServiceV2.getBlockedLookup(
        user1,
        new PaginationQuery(),
      );

      expect(relationship).not.toBeNull();
      expect(relationship.items.length).toBeGreaterThan(0);
    });

    it('should block user and create blocking relationship', async () => {
      const [blockedUser, blockerUser] = await Promise.all([
        repository
          .findRelationships({ userId: [user2._id], followedUser: user1._id })
          .exec(),
        repository
          .findRelationships({ userId: [user1._id], followedUser: user2._id })
          .exec(),
      ]);

      expect(blockerUser).not.toBeNull();
      expect(blockedUser).not.toBeNull();

      expect(blockedUser[0].blocked).toBeTruthy();
      expect(blockedUser[0].following).toBeFalsy();

      expect(blockerUser[0].blocking).toBeTruthy();
      expect(blockerUser[0].following).toBeFalsy();
    });

    it('should unblock user and remove blocking relationship', async () => {
      await userServiceV2.unblockUser(user1, String(user2._id));
      const [blockedUser, blockerUser] = await Promise.all([
        repository
          .findRelationships({ userId: [user2._id], followedUser: user1._id })
          .exec(),
        repository
          .findRelationships({ userId: [user1._id], followedUser: user2._id })
          .exec(),
      ]);

      expect(blockerUser).toHaveLength(0);
      expect(blockedUser).toHaveLength(0);
    });
  });

  describe('#follow', () => {
    let user1: User;
    let user2: User;
    beforeAll(async () => {
      const mocksUsers = await generateUser.generateMockUsers(2, 10);

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
    });
    it('should return empty user if user have not followers', async () => {
      const followers = await userServiceV2.getFollowers(
        user1.ownerAccount,
        user2,
        {
          maxResults: 10,
          hasRelationshipExpansion: true,
        },
      );
      expect(followers.users).toHaveLength(0);
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to follow is not found', async () => {
      await expect(
        userServiceV2.followUser(user1, 'undefined', user1.ownerAccount),
      ).rejects.toThrow(new CastcleException('USER_OR_PAGE_NOT_FOUND'));
    });

    it('should follow user and create follow relationship', async () => {
      await userServiceV2.followUser(
        user1,
        String(user2._id),
        user1.ownerAccount,
      );
      const followRelation = await repository
        .findRelationships({ userId: [user1._id], followedUser: user2._id })
        .exec();

      expect(followRelation).not.toBeNull();
      expect(followRelation[0].following).toBeTruthy();
    });

    it('should return user1 is following user2 after follow', async () => {
      const followingUser = await userServiceV2.getFollowing(
        user1.ownerAccount,
        user1,
        {
          hasRelationshipExpansion: true,
        },
      );
      expect(followingUser).not.toBeNull();
      expect((followingUser.users[0] as any).userId).toEqual(user2._id);
    });

    it('should return followers user after create follow relationship', async () => {
      const followers = await userServiceV2.getFollowers(
        user1.ownerAccount,
        user2,
        {
          maxResults: 10,
          hasRelationshipExpansion: true,
        },
      );

      expect(followers.users.length).toBeGreaterThan(0);
    });

    it('should remove relationship after unfollow user', async () => {
      await userServiceV2.unfollowUser(user1, String(user2._id));
      const followers = await userServiceV2.getFollowers(
        user1.ownerAccount,
        user2,
        {
          maxResults: 10,
          hasRelationshipExpansion: true,
        },
      );
      expect(followers.users).toHaveLength(0);
    });

    it('should return empty after user1 unfollow user2', async () => {
      const followingUser = await userServiceV2.getFollowing(
        user1.ownerAccount,
        user1,
        {
          maxResults: 10,
          hasRelationshipExpansion: true,
        },
      );
      expect(followingUser.users).toHaveLength(0);
    });
  });

  describe('#pages', () => {
    it('should return undefined when user have no page', async () => {
      const result = await userServiceV2.getMyPages(userDemo);
      expect(result[0]).toBeUndefined();
    });

    it('should return page when user create page', async () => {
      const page = await userServiceV2.createPage(userDemo, {
        castcleId: 'testNewPage',
        displayName: 'testNewPage',
      });

      expect(page).toBeDefined();
    });

    it('should return error when castcleId exist', async () => {
      expect(
        userServiceV2.createPage(userDemo, {
          castcleId: 'testNewPage',
          displayName: 'testNewPage',
        }),
      ).rejects.toThrow(new CastcleException('PAGE_IS_EXIST'));
    });

    it('should return page of user when created', async () => {
      const pages = await userServiceV2.getMyPages(userDemo);
      expect(pages[0]).toBeDefined();
    });
  });

  describe('getUserByKeyword', () => {
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateUser.generateMockUsers(20);
    });
    it('should get user by keyword', async () => {
      const getUserByKeyword = await userServiceV2.getUserByKeyword(
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: 'people-10',
          },
          hasRelationshipExpansion: false,
        },
        mocksUsers[0].user,
      );

      expect(getUserByKeyword.payload).toHaveLength(1);
    });

    it('should get user by keyword is empty', async () => {
      const getUserByKeyword = await userServiceV2.getUserByKeyword(
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: 'empty',
          },
          hasRelationshipExpansion: false,
        },
        mocksUsers[0].user,
      );

      expect(getUserByKeyword.payload).toHaveLength(0);
    });
  });

  describe('createQRCode', () => {
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateUser.generateMockUsers(1);
    });
    it('should get qr code size thumbnail', async () => {
      const createQRCode = await userServiceV2.createQRCode(
        'castcleChain',
        QRCodeImageSize.Thumbnail,
        mocksUsers[0].user._id,
      );

      expect(createQRCode.payload).toMatch(/base64/g);
    });
  });

  describe('#suggest', () => {
    let mockUsers: MockUserDetail[];
    let authorizer: any;

    beforeAll(async () => {
      mockUsers = await generateUser.generateMockUsers(3);

      jest.spyOn(dataService, 'getFollowingSuggestions').mockResolvedValue([
        {
          userId: mockUsers[0].user._id,
          engagements: 200,
        },
        {
          userId: mockUsers[1].user._id,
          engagements: 50,
        },
      ]);

      authorizer = {
        account: mockUsers[2].account,
        user: mockUsers[2].user,
        credential: mockUsers[2].credential,
      };
    });

    it('should return suggest user by datascience and cache to redis', async () => {
      const usersFiltered = await (
        suggestServiceV2 as any
      ).querySuggestByDataScience(
        authorizer.user.ownerAccount._id,
        authorizer.credential.accessToken,
      );

      expect(usersFiltered).toHaveLength(2);
    });

    it('should return next value of untilId', async () => {
      const usersFiltered = await (suggestServiceV2 as any).querySuggestByCache(
        authorizer.credential.accessToken,
        {
          untilId: mockUsers[0].user.id,
          hasRelationshipExpansion: false,
        },
      );
      expect(usersFiltered).toHaveLength(1);
    });

    it('should return previous value of sinceId', async () => {
      const usersFiltered = await (suggestServiceV2 as any).querySuggestByCache(
        authorizer.credential.accessToken,
        {
          sinceId: mockUsers[1].user.id,
          hasRelationshipExpansion: false,
        },
      );

      expect(usersFiltered).toHaveLength(1);
    });

    it('should return empty array if userId not exist in suggest user', async () => {
      const usersFiltered = await (suggestServiceV2 as any).querySuggestByCache(
        authorizer.credential.accessToken,
        { untilId: 'undefined', hasRelationshipExpansion: false },
      );
      expect(usersFiltered).toHaveLength(0);
    });
  });

  describe('updatePDPA', () => {
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateUser.generateMockUsers(2);
      Environment.PDPA_ACCEPT_DATES = ['20200701'];
    });

    it('should get user data pdpa in response', async () => {
      const userResponse = await userServiceV2.updatePDPA(
        '20200701',
        mocksUsers[0].account,
      );

      expect(userResponse).toBeUndefined();
    });
  });
  describe('getReferral', () => {
    let mockUsers: MockUserDetail[];
    beforeAll(async () => {
      mockUsers = await generateUser.generateMockUsers(2);

      guestDemo = await authService.createAccount({
        deviceUUID: `testuuid1`,
        languagesPreferences: ['th', 'th'],
        header: {
          platform: 'ios',
        },
        device: `testdevice1`,
      });

      await authServiceV2.registerWithEmail(guestDemo.credentialDocument, {
        hostUrl: 'http://test.com',
        ip: '0.0.0.0',
        email: `test1@gmail.com`,
        password: '12345678Ab',
        displayName: `Test1`,
        castcleId: `test1`,
        referral: mockUsers[0].user.displayId,
      });
    });
    it('should get user referee', async () => {
      const referee = await userServiceV2.getReferral(
        {
          maxResults: 10,
          hasRelationshipExpansion: false,
        },
        mockUsers[0].user,
        mockUsers[1].user,
        true,
      );

      expect(referee.payload).toHaveLength(1);
    });

    it('should get user referrer', async () => {
      const referrer = await userServiceV2.getReferral(
        {
          hasRelationshipExpansion: false,
        },
        mockUsers[0].user,
        mockUsers[1].user,
        false,
      );

      expect(referrer.payload).not.toBeNull();
    });
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
    expect(userServiceV2).toBeDefined();
  });
});
