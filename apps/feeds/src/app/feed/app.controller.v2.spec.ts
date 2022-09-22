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
  AdsService,
  AnalyticService,
  ContentService,
  ContentServiceV2,
  ContentType,
  DataService,
  HashtagService,
  KeywordType,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QueueName,
  RankerService,
  SocialSyncServiceV2,
  SuggestionServiceV2,
  TAccountService,
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
import { Repository } from 'libs/database/src/lib/repositories';
import { FeedsControllerV2 } from './app.controller.v2';
import { RecentFeedService } from './services/recent-feed/service.abstract';
import { RecentFeedServiceImpl } from './services/recent-feed/service.implementation';

describe('FeedsControllerV2', () => {
  let app: TestingModule;
  let controller: FeedsControllerV2;
  let contentServiceV2: ContentServiceV2;
  let repository: Repository;
  let account: Account;
  let user: User;

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
      controllers: [FeedsControllerV2],
      providers: [
        AdsService,
        ContentService,
        ContentServiceV2,
        DataService,
        HashtagService,
        RankerService,
        Repository,
        SuggestionServiceV2,
        UserServiceV2,
        { provide: RecentFeedService, useClass: RecentFeedServiceImpl },
        { provide: SocialSyncServiceV2, useValue: {} },
        { provide: Downloader, useValue: {} },
        { provide: AnalyticService, useValue: {} },
        { provide: Mailer, useValue: {} },
        { provide: NotificationServiceV2, useValue: {} },
        { provide: TAccountService, useValue: {} },
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

    contentServiceV2 = app.get(ContentServiceV2);
    controller = app.get(FeedsControllerV2);
    repository = app.get(Repository);

    const createdUser = await app.createUser({ castcleId: 'castcle' });
    account = createdUser.account;
    user = createdUser.user;

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        contentServiceV2.createContent(
          {
            payload: {
              message: `hello content ${index}`,
            },
            type: ContentType.Short,
            castcleId: user.displayId,
          },
          user,
        ),
      ),
    );
  });

  afterAll(() => {
    return app.close();
  });

  describe('#getSearchRecent', () => {
    it('should get all recent search', async () => {
      const authorizer = new Authorizer(account, user, 'uuid');
      const getSearchRecent = await controller.getSearchRecent(authorizer, {
        keyword: {
          type: KeywordType.Word,
          input: 'h',
        },
        maxResults: 20,
        hasRelationshipExpansion: true,
      });

      expect(getSearchRecent.payload).toHaveLength(20);
    });

    it('should recent search is empty', async () => {
      const authorizer = new Authorizer(account, user, 'uuid');
      const getSearchRecent = await controller.getSearchRecent(authorizer, {
        keyword: {
          type: KeywordType.Mention,
          input: 'test',
        },
        maxResults: 20,
        hasRelationshipExpansion: true,
      });

      expect(getSearchRecent.payload).toHaveLength(0);
    });
  });

  describe('#getSearchTrends()', () => {
    beforeAll(async () => {
      const contents = await repository.findContents(
        {
          keyword: {
            type: KeywordType.Word,
            input: 'h',
          },
          maxResults: 20,
          decayDays: 7,
          excludeAuthor: [],
        },
        { projection: { _id: 1 } },
      );

      const contentsObj = {};

      contents.forEach((content) => {
        contentsObj[content._id] = Math.random();
      });

      jest
        .spyOn(contentServiceV2, 'sortContentsByScore')
        .mockResolvedValueOnce(contentsObj);
    });
    it('should get cast is exists.', async () => {
      const authorizer = new Authorizer(account, user, 'uuid');
      const getSearchTrends = await controller.getSearchTrends(authorizer, {
        keyword: {
          type: KeywordType.Mention,
          input: 'h',
        },
        hasRelationshipExpansion: true,
      });
      expect(getSearchTrends.payload).toHaveLength(0);
    });
  });
});
