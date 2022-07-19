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
  AdsBidType,
  AdsBoostStatus,
  AdsObjective,
  AdsPaymentMethod,
  AdsService,
  AdsStatus,
  AnalyticService,
  AuthenticationService,
  CampaignService,
  ContentService,
  ContentServiceV2,
  ContentType,
  DataService,
  HashtagService,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  NotificationServiceV2,
  QueueName,
  TAccountService,
  Transaction,
  UserService,
  UserServiceV2,
  generateMockUsers,
  mockDeposit,
} from '@castcle-api/database';
import { Mailer } from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { AdsController } from './ads.controller';

describe('AdsController', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let appController: AdsController;
  let mocksUsers: MockUserDetail[];
  let userServiceV1: UserService;
  let authService: AuthenticationService;
  let transactionModel: Model<Transaction>;
  let contentService: ContentServiceV2;
  let contentPayload: any;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CacheModule.register(),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
      ],
      controllers: [AdsController],
      providers: [
        AnalyticService,
        AuthenticationService,
        ContentService,
        Repository,
        UserService,
        UserServiceV2,
        ContentServiceV2,
        NotificationService,
        NotificationServiceV2,
        HashtagService,
        TAccountService,
        {
          provide: DataService,
          useValue: {
            personalizeContents: async (
              accountId: string,
              contentIds: string[],
            ) => ({
              [contentIds[0]]: 4,
            }),
          },
        },
        AdsService,
        { provide: CampaignService, useValue: {} },
        { provide: Mailer, useValue: {} },
        { provide: NotificationService, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.CAMPAIGN),
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

    appController = app.get(AdsController);
    userServiceV1 = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentServiceV2>(ContentServiceV2);
    transactionModel = app.get(getModelToken('Transaction'));

    mocksUsers = await generateMockUsers(1, 1, {
      userService: userServiceV1,
      accountService: authService,
    });

    await mockDeposit(mocksUsers[0].user, 9999, transactionModel);
    contentPayload = await contentService.createContent(
      {
        castcleId: mocksUsers[0].user.displayId,
        payload: {
          message: 'yeah',
        },
        type: ContentType.Short,
      },
      mocksUsers[0].user,
    );
  });

  describe('create User Ads', () => {
    it('should return AdsResponse', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
      const result = await appController.createUserAds(authorizer, {
        campaignMessage: 'test u',
        campaignName: 'test u',
        dailyBidType: AdsBidType.Auto,
        dailyBudget: 1,
        duration: 2,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.TOKEN_WALLET,
        castcleId: mocksUsers[0].pages[0].id,
      });
      expect(result).toEqual(
        expect.objectContaining({
          campaignMessage: 'test u',
          campaignName: 'test u',
          dailyBidType: AdsBidType.Auto,
          dailyBudget: 1,
          duration: 2,
          objective: AdsObjective.Engagement,
          adStatus: AdsStatus.Processing,
          boostStatus: AdsBoostStatus.Unknown,
          boostType: 'page',
        }),
      );
    });
  });
  describe('create Content Ads', () => {
    it('should return AdsResponse when promote content', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const result = await appController.createCastAds(authorizer, {
        campaignMessage: 'test k',
        campaignName: 'test k',
        dailyBidType: AdsBidType.Auto,
        dailyBudget: 1,
        duration: 2,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.TOKEN_WALLET,
        contentId: contentPayload.payload.id,
      });
      expect(result).toEqual(
        expect.objectContaining({
          campaignMessage: 'test k',
          campaignName: 'test k',
          dailyBidType: AdsBidType.Auto,
          dailyBudget: 1,
          duration: 2,
          objective: AdsObjective.Engagement,
          boostType: 'content',
        }),
      );
    });
  });
  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
});
