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
import { CastcleMongooseModule } from '@castcle-api/environments';
import { CreatedUser, TestingModule } from '@castcle-api/testing';
import { Downloader } from '@castcle-api/utils/aws';
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
import { Types } from 'mongoose';
import {
  AnalyticService,
  AuthenticationServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  SocialSyncServiceV2,
  UserServiceV2,
} from '../database.module';
import { CreateHashtag } from '../dtos/hashtag.dto';
import { ExcludeType, KeywordType, QueueName } from '../models';
import { Repository } from '../repositories';
import { HashtagService } from './hashtag.service';
import { SearchServiceV2 } from './search.service.v2';

describe('SearchServiceV2', () => {
  let moduleRef: TestingModule;
  let hashtagService: HashtagService;
  let mocksUsers: CreatedUser[];
  let service: SearchServiceV2;
  let userServiceV2: UserServiceV2;

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CacheModule.register(),
        CastcleMongooseModule,
        HttpModule,
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        AuthenticationServiceV2,
        HashtagService,
        NotificationServiceV2,
        Repository,
        SearchServiceV2,
        UserServiceV2,
        { provide: SocialSyncServiceV2, useValue: {} },
        { provide: Downloader, useValue: {} },
        { provide: AnalyticService, useValue: {} },
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
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.REPORTING),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.VERIFY_EMAIL),
          useValue: { add: jest.fn() },
        },
      ],
    });

    hashtagService = moduleRef.get<HashtagService>(HashtagService);
    service = moduleRef.get<SearchServiceV2>(SearchServiceV2);
    userServiceV2 = moduleRef.get(UserServiceV2);

    const mockHashtag = async (slug, hName, hScore) => {
      const newHashtag: CreateHashtag = {
        tag: slug,
        score: hScore,
        aggregator: {
          _id: String(new Types.ObjectId()),
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

    mocksUsers = await moduleRef.createUsers(5);
  });

  afterAll(() => {
    return moduleRef.close();
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
            input: 'user-',
          },
        },
        mocksUsers[0].user,
      );

      expect(getByKeyword.keyword).toContainEqual({
        text: 'user-',
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
            input: 'user-',
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
            input: mocksUsers[2].user.displayId,
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
});
