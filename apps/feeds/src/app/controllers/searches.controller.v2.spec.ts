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
  AnalyticService,
  AuthenticationService,
  CampaignService,
  ContentService,
  CreateHashtag,
  ExcludeType,
  HashtagService,
  KeywordType,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QueueName,
  SearchServiceV2,
  UserService,
  UserServiceV2,
  generateMockUsers,
} from '@castcle-api/database';
import { Mailer } from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { SearchesControllerV2 } from './searches.controller.v2';

describe('SearchesControllerV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let controller: SearchesControllerV2;
  let hashtagService: HashtagService;
  let authService: AuthenticationService;
  let userService: UserService;
  let userServiceV2: UserServiceV2;
  let mocksUsers: MockUserDetail[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        CacheModule.register(),
      ],
      controllers: [SearchesControllerV2],
      providers: [
        SearchServiceV2,
        Repository,
        UserServiceV2,
        ContentService,
        AuthenticationService,
        UserService,
        HashtagService,
        NotificationServiceV2,
        { provide: AnalyticService, useValue: {} },
        { provide: CampaignService, useValue: {} },
        { provide: Mailer, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.REPORTING),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    authService = app.get(AuthenticationService);
    hashtagService = app.get<HashtagService>(HashtagService);
    userService = app.get(UserService);
    userServiceV2 = app.get<UserServiceV2>(UserServiceV2);

    controller = app.get<SearchesControllerV2>(SearchesControllerV2);

    mocksUsers = await generateMockUsers(20, 0, {
      userService: userService,
      accountService: authService,
    });
    const mockHashtag = async (slug, hName, hScore) => {
      const newHashtag: CreateHashtag = {
        tag: slug,
        score: hScore,
        aggregator: {
          _id: String(Types.ObjectId()),
        },
        name: hName,
      };
      await hashtagService.create(newHashtag);
    };

    for (let i = 0; i < 20; i++) {
      await mockHashtag(`#castcle${i}`, `Castcle ${i}`, 90 - i);
    }
  });

  describe('#getTopTrends', () => {
    it('should get all top trend', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getTopTrends = await controller.getTopTrends(authorizer, {
        limit: 10,
      });

      expect(getTopTrends.hashtags).toHaveLength(10);
      expect(getTopTrends.users).toHaveLength(10);
    });

    it('should get top trend exclude hashtags', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getTopTrends = await controller.getTopTrends(authorizer, {
        limit: 10,
        exclude: [ExcludeType.Hashtags],
      });

      expect(getTopTrends.hashtags.length).toEqual(0);
      expect(getTopTrends.users.length).toEqual(10);
    });

    it('should get top trend exclude users', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getTopTrends = await controller.getTopTrends(authorizer, {
        limit: 10,
        exclude: [ExcludeType.Users],
      });

      expect(getTopTrends.hashtags.length).toEqual(10);
      expect(getTopTrends.users.length).toEqual(0);
    });

    it('should get empty top trend with exclude all', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getTopTrends = await controller.getTopTrends(authorizer, {
        exclude: [ExcludeType.Users, ExcludeType.Hashtags],
      });

      expect(getTopTrends.hashtags.length).toEqual(0);
      expect(getTopTrends.users.length).toEqual(0);
    });
  });

  describe('getByKeyword', () => {
    it('should get user by keyword', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
      const getByKeyword = await controller.getByKeyword(authorizer, {
        keyword: {
          type: KeywordType.Mention,
          input: 'c',
        },
        maxResults: 25,
        hasRelationshipExpansion: true,
      });

      expect(getByKeyword.keyword).toContainEqual({
        text: 'c',
        isTrending: true,
      });
      expect(getByKeyword.hashtags).toHaveLength(10);
      expect(getByKeyword.users).toHaveLength(10);
    });

    it('should get user by keyword is empty', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
      const getByKeyword = await controller.getByKeyword(authorizer, {
        keyword: {
          type: KeywordType.Mention,
          input: 'empty',
        },
        maxResults: 25,
        hasRelationshipExpansion: true,
      });

      expect(getByKeyword.hashtags).toHaveLength(0);
      expect(getByKeyword.users).toHaveLength(0);
    });
  });

  describe('getUserMentions', () => {
    beforeAll(async () => {
      await userServiceV2.followUser(
        mocksUsers[1].user,
        mocksUsers[0].user._id,
        mocksUsers[1].account,
      );
    });
    it('should get user by keyword', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getUserMentions = await controller.getUserMentions(authorizer, {
        keyword: {
          type: KeywordType.Mention,
          input: 'm',
        },
        hasRelationshipExpansion: false,
      });

      expect(getUserMentions.payload).toHaveLength(1);
    });

    it('should get user by keyword is empty', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getUserMentions = await controller.getUserMentions(authorizer, {
        maxResults: 25,
        keyword: {
          type: KeywordType.Mention,
          input: 'empty',
        },
        hasRelationshipExpansion: false,
      });

      expect(getUserMentions.payload).toHaveLength(0);
    });
  });

  describe('getSearchByKeyword', () => {
    it('should get user by keyword', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
      const getSearchByKeyword = await controller.getSearchByKeyword(
        authorizer,
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: 'mock-10',
          },
          hasRelationshipExpansion: false,
        },
      );

      expect(getSearchByKeyword.payload).toHaveLength(1);
    });

    it('should get user by keyword is empty', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getSearchByKeyword = await controller.getSearchByKeyword(
        authorizer,
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: 'empty',
          },
          hasRelationshipExpansion: false,
        },
      );

      expect(getSearchByKeyword.payload).toHaveLength(0);
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
});
