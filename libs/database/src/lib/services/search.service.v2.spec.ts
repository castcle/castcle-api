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
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import {
  AnalyticService,
  AuthenticationServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  UserServiceV2,
} from '../database.module';
import { CreateHashtag } from '../dtos/hashtag.dto';
import { MockUserDetail, MockUserService } from '../mocks';
import { ExcludeType, KeywordType, QueueName } from '../models';
import { Repository } from '../repositories';
import { CampaignService } from './campaign.service';
import { HashtagService } from './hashtag.service';
import { SearchServiceV2 } from './search.service.v2';

describe('SearchServiceV2', () => {
  let moduleRef: TestingModule;
  let mongod: MongoMemoryServer;
  let generateUser: MockUserService;
  let hashtagService: HashtagService;
  let mocksUsers: MockUserDetail[];
  let service: SearchServiceV2;
  let userServiceV2: UserServiceV2;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        AuthenticationServiceV2,
        HashtagService,
        MockUserService,
        NotificationServiceV2,
        Repository,
        SearchServiceV2,
        UserServiceV2,
        { provide: AnalyticService, useValue: {} },
        { provide: CampaignService, useValue: {} },
        { provide: FacebookClient, useValue: {} },
        { provide: GoogleClient, useValue: {} },
        { provide: Mailer, useValue: {} },
        { provide: TwilioClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.REPORTING),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    generateUser = moduleRef.get(MockUserService);
    hashtagService = moduleRef.get<HashtagService>(HashtagService);
    service = moduleRef.get<SearchServiceV2>(SearchServiceV2);
    userServiceV2 = moduleRef.get(UserServiceV2);

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
    await Promise.all(
      [...Array(5)]
        .fill('hashtag')
        .map((name, index) =>
          mockHashtag(
            `#castcle${name + index}`,
            `Castcle ${name + index}`,
            90 - index,
          ),
        ),
    );

    mocksUsers = await generateUser.generateMockUsers(5);
  });

  describe('#getTopTrends', () => {
    it('should get all top trend', async () => {
      const getTopTrends = await service.getTopTrends({ limit: 100 });

      expect(getTopTrends.hashtags).toHaveLength(5);
      expect(getTopTrends.users).toHaveLength(5);
    });

    it('should get top trend exclude hashtags', async () => {
      const getTopTrends = await service.getTopTrends({
        limit: 5,
        exclude: [ExcludeType.Hashtags],
      });

      expect(getTopTrends.hashtags.length).toEqual(0);
      expect(getTopTrends.users.length).toEqual(5);
    });

    it('should get top trend exclude users', async () => {
      const getTopTrends = await service.getTopTrends({
        limit: 5,
        exclude: [ExcludeType.Users],
      });

      expect(getTopTrends.hashtags.length).toEqual(5);
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

  describe('getByKeyword', () => {
    it('should get user by keyword', async () => {
      const getByKeyword = await service.getByKeyword(
        {
          limit: 5,
          keyword: {
            type: KeywordType.Mention,
            input: 'p',
          },
        },
        mocksUsers[0].user,
      );

      expect(getByKeyword.keyword).toContainEqual({
        text: 'p',
        isTrending: true,
      });
      expect(getByKeyword.hashtags).toHaveLength(0);
      expect(getByKeyword.users).toHaveLength(5);
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
            input: 'p',
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
          keyword: {
            type: KeywordType.Word,
            input: 'people-2',
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
          keyword: {
            type: KeywordType.Word,
            input: 'empty',
          },
          hasRelationshipExpansion: false,
        },
        mocksUsers[0].user,
      );

      expect(getSearchByKeyword.payload).toHaveLength(0);
    });
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });
});
