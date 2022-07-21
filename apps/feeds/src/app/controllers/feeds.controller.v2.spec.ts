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
  AnalyticService,
  AuthenticationService,
  CampaignService,
  ContentService,
  ContentServiceV2,
  ContentType,
  DataService,
  HashtagService,
  KeywordType,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  NotificationServiceV2,
  QueueName,
  RankerService,
  SuggestionServiceV2,
  TAccountService,
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
import { FeedsControllerV2 } from './feeds.controller.v2';

describe('FeedsControllerV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let controller: FeedsControllerV2;
  let authService: AuthenticationService;
  let userService: UserService;
  let contentServiceV2: ContentServiceV2;
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
      controllers: [FeedsControllerV2],
      providers: [
        AdsService,
        AuthenticationService,
        ContentService,
        ContentServiceV2,
        DataService,
        HashtagService,
        RankerService,
        Repository,
        SuggestionServiceV2,
        UserService,
        UserServiceV2,
        { provide: AnalyticService, useValue: {} },
        { provide: CampaignService, useValue: {} },
        { provide: Mailer, useValue: {} },
        { provide: NotificationService, useValue: {} },
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
    }).compile();

    authService = app.get(AuthenticationService);
    userService = app.get(UserService);
    contentServiceV2 = app.get(ContentServiceV2);

    controller = app.get<FeedsControllerV2>(FeedsControllerV2);

    mocksUsers = await generateMockUsers(20, 0, {
      userService: userService,
      accountService: authService,
    });

    for (let index = 0; index < 20; index++) {
      contentServiceV2.createContent(
        {
          payload: {
            message: `hello content ${index}`,
          },
          type: ContentType.Short,
          castcleId: mocksUsers[0].user.displayId,
        },
        mocksUsers[0].user,
      );
    }
  });

  describe('#getSearchRecent', () => {
    it('should get all recent search', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
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
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
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
      const contents = await (contentServiceV2 as any).repository.findContents(
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
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
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
  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
});
