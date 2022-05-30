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

import { CastcleBullModule } from '@castcle-api/environments';
import { Mailer } from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { HttpModule } from '@nestjs/axios';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  AnalyticService,
  CampaignService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  UserService,
  UserServiceV2,
} from '../database.module';
import {
  Meta,
  PageResponseDto,
  PaginationQuery,
  UserResponseDto,
} from '../dtos';
import { generateMockUsers, MockUserDetail } from '../mocks/user.mocks';
import { KeywordType, QueueName } from '../models';
import { Repository } from '../repositories';
import { Account, AccountActivation, Credential, User } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { CommentService } from './comment.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';

describe('UserServiceV2', () => {
  let mongod: MongoMemoryReplSet;
  let userServiceV2: UserServiceV2;
  let userServiceV1: UserService;
  let authService: AuthenticationService;
  let guestDemo: {
    accountDocument: Account;
    credentialDocument: Credential;
  };
  let accountDemo: AccountActivation;
  let userDemo: User;
  let repository: Repository;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    const module = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        HttpModule,
        MongooseModule.forRoot(mongod.getUri(), { useCreateIndex: true }),
        MongooseAsyncFeatures,
        CastcleBullModule,
        BullModule.registerQueue({ name: QueueName.NOTIFICATION }),
        MongooseForFeatures,
      ],
      providers: [
        AnalyticService,
        AuthenticationService,
        CommentService,
        ContentService,
        HashtagService,
        NotificationService,
        Repository,
        UserService,
        UserServiceV2,
        { provide: CampaignService, useValue: {} },
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

    userServiceV2 = module.get<UserServiceV2>(UserServiceV2);
    userServiceV1 = module.get<UserService>(UserService);
    repository = module.get<Repository>(Repository);
    authService = module.get<AuthenticationService>(AuthenticationService);
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

  describe('#blockUser', () => {
    let user1: User;
    let user2: User;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(2, 10, {
        userService: userServiceV1,
        accountService: authService,
      });

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to block is not found', async () => {
      await userServiceV2.blockUser(user2, String(user1._id));
      const blocking = await userServiceV2.getUserBlock(user1);

      expect(blocking).toHaveLength(1);
      expect(blocking).toContainEqual(user2._id);
    });
  });

  describe('#blockUser', () => {
    let user1: User;
    let user2: User;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(2, 10, {
        userService: userServiceV1,
        accountService: authService,
      });

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;

      await userServiceV2.blockUser(user1, String(user2._id));
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to block is not found', async () => {
      await expect(userServiceV2.blockUser(user1, 'undefined')).rejects.toBe(
        CastcleException.USER_OR_PAGE_NOT_FOUND,
      );
    });

    it('should return blocked lookup user', async () => {
      const relationship: {
        users: (PageResponseDto | UserResponseDto)[];
        meta: Meta;
      } = await userServiceV2.getBlockedLookup(user1, new PaginationQuery());

      expect(relationship).not.toBeNull();
      expect(relationship.users.length).toBeGreaterThan(0);
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
      const mocksUsers = await generateMockUsers(2, 10, {
        userService: userServiceV1,
        accountService: authService,
      });

      user1 = mocksUsers[0].user;
      user2 = mocksUsers[1].user;
      await userServiceV2.followUser(
        user1,
        String(user2._id),
        user1.ownerAccount,
      );
    });

    it('should throw USER_OR_PAGE_NOT_FOUND when user to follow is not found', async () => {
      await expect(
        userServiceV2.followUser(user1, 'undefined', user1.ownerAccount),
      ).rejects.toBe(CastcleException.USER_OR_PAGE_NOT_FOUND);
    });

    it('should follow user and create follow relationship', async () => {
      const followRelation = await repository
        .findRelationships({ userId: [user1._id], followedUser: user2._id })
        .exec();

      expect(followRelation).not.toBeNull();
      expect(followRelation[0].following).toBeTruthy();
    });

    it('should remove relationship after unfollow user', async () => {
      await userServiceV2.unfollowUser(user1, String(user2._id));

      const followRelation = await repository
        .findRelationships({ userId: [user1._id], followedUser: user2._id })
        .exec();

      expect(followRelation).toHaveLength(0);
    });
  });

  describe('#getMyPages', () => {
    it('should return undefined when user have no page', async () => {
      const result = await userServiceV2.getMyPages(userDemo);
      expect(result[0]).toBeUndefined();
    });

    it('should return page of user when created', async () => {
      await userServiceV1.createPageFromCredential(
        guestDemo.credentialDocument,
        {
          castcleId: accountDemo.account.id,
          displayName: 'sp002',
        },
      );
      const pages = await userServiceV2.getMyPages(userDemo);
      expect(pages[0]).toBeDefined();
    });
  });

  describe('getUserByKeyword', () => {
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(20, 0, {
        userService: userServiceV1,
        accountService: authService,
      });
    });
    it('should get user by keyword', async () => {
      const getUserByKeyword = await userServiceV2.getUserByKeyword(
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: 'mock-10',
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

  it('should be defined', () => {
    expect(repository).toBeDefined();
    expect(userServiceV2).toBeDefined();
  });

  afterAll(async () => {
    await mongod.stop();
  });
});
