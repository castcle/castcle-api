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
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AnalyticService,
  AuthenticationService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  UserService,
  UserServiceV2,
} from '../database.module';
import { generateMockUsers, MockUserDetail } from '../mocks';
import { CreateHashtag } from '../dtos/hashtag.dto';
import { Repository } from '../repositories';
import { HashtagService } from './hashtag.service';
import { SearchServiceV2 } from './search.service.v2';
import { getQueueToken } from '@nestjs/bull';
import { QueueName } from '../models';
import { Types } from 'mongoose';
import { ExcludeType, KeywordType } from './../models/feed.enum';
import { ContentService } from './content.service';
import { Mailer } from '@castcle-api/utils/clients';
import { CampaignService } from './campaign.service';

describe('SearchServiceV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let hashtagService: HashtagService;
  let service: SearchServiceV2;
  let authService: AuthenticationService;
  let userService: UserService;
  let mocksUsers: MockUserDetail[];
  let userServiceV2: UserServiceV2;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        SearchServiceV2,
        Repository,
        UserServiceV2,
        ContentService,
        AuthenticationService,
        UserService,
        HashtagService,
        NotificationService,
        { provide: AnalyticService, useValue: {} },
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
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    authService = app.get(AuthenticationService);
    hashtagService = app.get<HashtagService>(HashtagService);
    service = app.get<SearchServiceV2>(SearchServiceV2);
    userService = app.get(UserService);
    userServiceV2 = app.get(UserServiceV2);

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

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('#getTopTrends', () => {
    it('should get all top trend', async () => {
      const getTopTrends = await service.getTopTrends({ limit: 100 });

      expect(getTopTrends.hashtags).toHaveLength(20);
      expect(getTopTrends.users).toHaveLength(20);
    });

    it('should get top trend exclude hashtags', async () => {
      const getTopTrends = await service.getTopTrends({
        limit: 10,
        exclude: [ExcludeType.Hashtags],
      });

      expect(getTopTrends.hashtags.length).toEqual(0);
      expect(getTopTrends.users.length).toEqual(10);
    });

    it('should get top trend exclude users', async () => {
      const getTopTrends = await service.getTopTrends({
        limit: 10,
        exclude: [ExcludeType.Users],
      });

      expect(getTopTrends.hashtags.length).toEqual(10);
      expect(getTopTrends.users.length).toEqual(0);
    });

    it('should get empty top trend with exclude all', async () => {
      const getTopTrends = await service.getTopTrends({
        exclude: [ExcludeType.Users, ExcludeType.Hashtags],
      });
      expect(getTopTrends.hashtags.length).toEqual(0);
      expect(getTopTrends.users.length).toEqual(0);
    });
  });

  describe('toPayloadHashtags', () => {
    it('should get payload hashtags', async () => {
      const toPayloadHashtags = await (service as any).toPayloadHashtags([
        {
          _id: Types.ObjectId(),
          tag: 'test',
          createdAt: new Date(),
          name: 'TEST',
          score: 1,
          updatedAt: new Date(),
        },
      ]);

      expect(toPayloadHashtags[0].slug).toEqual('test');
      expect(toPayloadHashtags[0].name).toEqual('TEST');
      expect(toPayloadHashtags[0].isTrending).toBeUndefined();
      expect(toPayloadHashtags[0].key).toBeUndefined();
    });

    it('should get payload hashtags at optional', async () => {
      const toPayloadHashtags = await (service as any).toPayloadHashtags([
        {
          _id: Types.ObjectId(),
          tag: 'test',
          createdAt: new Date(),
          name: 'TEST',
          score: 1,
          updatedAt: new Date(),
        },
        {
          key: 'test',
          isTrending: true,
        },
      ]);

      expect(toPayloadHashtags[0].isTrending).not.toBeNull();
      expect(toPayloadHashtags[0].key).not.toBeNull();
    });
  });

  describe('getByKeyword', () => {
    it('should get user by keyword', async () => {
      const getByKeyword = await service.getByKeyword(
        {
          limit: 10,
          keyword: {
            type: KeywordType.Mention,
            input: 'c',
          },
        },
        mocksUsers[0].user,
      );

      expect(getByKeyword.keyword).toContainEqual({
        text: 'c',
        isTrending: true,
      });
      expect(getByKeyword.hashtags).toHaveLength(10);
      expect(getByKeyword.users).toHaveLength(10);
    });

    it('should get user by keyword is empty', async () => {
      const getByKeyword = await service.getByKeyword(
        {
          limit: 10,
          keyword: {
            type: KeywordType.Mention,
            input: 'empty',
          },
        },
        mocksUsers[0].user,
      );

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
      const getUserMentions = await service.getUserMentions(
        {
          keyword: {
            type: KeywordType.Mention,
            input: 'm',
          },
          hasRelationshipExpansion: false,
        },
        mocksUsers[0].user,
      );

      expect(getUserMentions.payload).toHaveLength(1);
    });

    it('should get user by keyword is empty', async () => {
      const getUserMentions = await service.getUserMentions(
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

      expect(getUserMentions.payload).toHaveLength(0);
    });
  });

  describe('getSearchByKeyword', () => {
    it('should get user by keyword', async () => {
      const getSearchByKeyword = await service.getSearchByKeyword(
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

      expect(getSearchByKeyword.payload).toHaveLength(1);
    });

    it('should get user by keyword is empty', async () => {
      const getSearchByKeyword = await service.getSearchByKeyword(
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

      expect(getSearchByKeyword.payload).toHaveLength(0);
    });
  });
});
