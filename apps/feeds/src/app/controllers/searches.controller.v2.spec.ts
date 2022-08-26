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
  AnalyticService,
  CampaignService,
  ContentService,
  ExcludeType,
  HashtagService,
  KeywordType,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QueueName,
  Repository,
  SearchServiceV2,
  SocialSyncServiceV2,
  User,
  UserServiceV2,
} from '@castcle-api/database';
import { CastcleMongooseModule } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { Downloader } from '@castcle-api/utils/aws';
import { Mailer } from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { SearchesControllerV2 } from './searches.controller.v2';

describe('SearchesControllerV2', () => {
  let app: TestingModule;
  let controller: SearchesControllerV2;
  let hashtagService: HashtagService;
  let userServiceV2: UserServiceV2;
  let account: Account;
  let user: User;
  const uuid = 'uuid';

  beforeAll(async () => {
    app = await TestingModule.createWithDb({
      imports: [
        HttpModule,
        CastcleMongooseModule,
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        CacheModule.register(),
        JwtModule,
      ],
      controllers: [SearchesControllerV2],
      providers: [
        ContentService,
        HashtagService,
        NotificationServiceV2,
        Repository,
        SearchServiceV2,
        UserServiceV2,
        { provide: SocialSyncServiceV2, useValue: {} },
        { provide: Downloader, useValue: {} },
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
    });

    hashtagService = app.get(HashtagService);
    userServiceV2 = app.get(UserServiceV2);
    controller = app.get(SearchesControllerV2);
  });

  afterAll(() => {
    return app.close();
  });

  beforeEach(async () => {
    const created = await app.createUser();
    account = created.account;
    user = created.user;

    await Promise.all([
      ...Array.from({ length: 20 }, (_, i) =>
        app.createUser({ castcleId: `mock-${i}` }),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        hashtagService.create({
          tag: `#castcle${i}`,
          score: 90 - i,
          aggregator: { _id: new Types.ObjectId().toString() },
          name: `Castcle ${i}`,
        }),
      ),
    ]);
  });

  afterEach(() => {
    return app.cleanDb();
  });

  describe('#getTopTrends', () => {
    it('should get all top trend', async () => {
      const authorizer = new Authorizer(account, user, uuid);
      const getTopTrends = await controller.getTopTrends(authorizer, {
        limit: 10,
      });

      expect(getTopTrends.hashtags).toHaveLength(10);
      expect(getTopTrends.users).toHaveLength(10);
    });

    it('should get top trend exclude hashtags', async () => {
      const authorizer = new Authorizer(account, user, uuid);
      const getTopTrends = await controller.getTopTrends(authorizer, {
        limit: 10,
        exclude: [ExcludeType.Hashtags],
      });

      expect(getTopTrends.hashtags.length).toEqual(0);
      expect(getTopTrends.users.length).toEqual(10);
    });

    it('should get top trend exclude users', async () => {
      const authorizer = new Authorizer(account, user, uuid);
      const getTopTrends = await controller.getTopTrends(authorizer, {
        limit: 10,
        exclude: [ExcludeType.Users],
      });

      expect(getTopTrends.hashtags.length).toEqual(10);
      expect(getTopTrends.users.length).toEqual(0);
    });

    it('should get empty top trend with exclude all', async () => {
      const authorizer = new Authorizer(account, user, uuid);
      const getTopTrends = await controller.getTopTrends(authorizer, {
        exclude: [ExcludeType.Users, ExcludeType.Hashtags],
      });

      expect(getTopTrends.hashtags.length).toEqual(0);
      expect(getTopTrends.users.length).toEqual(0);
    });
  });

  describe('getByKeyword', () => {
    it('should get user by keyword', async () => {
      const authorizer = new Authorizer(account, user, uuid);
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
      const authorizer = new Authorizer(account, user, uuid);
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
    beforeEach(async () => {
      const created = await app.createUser({ castcleId: 'm' });
      await userServiceV2.followUser(created.user, user._id, created.account);
    });

    it('should get user by keyword', async () => {
      const authorizer = new Authorizer(account, user, uuid);
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
      const authorizer = new Authorizer(account, user, uuid);
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
      const authorizer = new Authorizer(account, user, uuid);
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
      const authorizer = new Authorizer(account, user, uuid);
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
});
