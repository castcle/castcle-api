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
  CampaignService,
  ContentService,
  ContentServiceV2,
  ContentType,
  DataService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QueueName,
  SocialSyncServiceV2,
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
import { AdsControllerV2 } from './ads.controller.v2';

describe('AdsController', () => {
  let app: TestingModule;
  let appController: AdsControllerV2;
  let contentService: ContentServiceV2;
  let authorizer: Authorizer;
  let contentPayload: any;
  let page: User;

  beforeAll(async () => {
    app = await TestingModule.createWithDb({
      imports: [
        CastcleMongooseModule,
        CacheModule.register(),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
        JwtModule,
      ],
      controllers: [AdsControllerV2],
      providers: [
        AnalyticService,
        ContentService,
        ContentServiceV2,
        HashtagService,
        NotificationServiceV2,
        Repository,
        TAccountService,
        UserServiceV2,
        { provide: SocialSyncServiceV2, useValue: {} },
        { provide: Downloader, useValue: {} },
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
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NEW_TRANSACTION),
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

    appController = app.get(AdsControllerV2);
    contentService = app.get(ContentServiceV2);

    const { account, user, pages } = await app.createUser({ pageSize: 1 });
    authorizer = new Authorizer(account, user, 'uuid');
    page = pages[0];

    await app.deposit(user._id, 9999);
    await app.deposit(pages[0]._id, 9999);
    contentPayload = await contentService.createContent(
      {
        castcleId: user.displayId,
        payload: {
          message: 'yeah',
        },
        type: ContentType.Short,
      },
      user,
    );
  });

  afterAll(() => {
    return app.close();
  });

  describe('create User Ads', () => {
    it('should return AdsResponse', async () => {
      const result = await appController.createUserAds(authorizer, {
        campaignMessage: 'test u',
        campaignName: 'test u',
        dailyBidType: AdsBidType.Auto,
        dailyBudget: 1,
        duration: 2,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.TOKEN_WALLET,
        castcleId: page.displayId,
        dailyBidValue: 1,
      });
      expect(result).toMatchObject({
        campaignMessage: 'test u',
        campaignName: 'test u',
        dailyBidType: AdsBidType.Auto,
        dailyBudget: 1,
        duration: 2,
        objective: AdsObjective.Engagement,
        adStatus: AdsStatus.Processing,
        boostStatus: AdsBoostStatus.Unknown,
        boostType: 'user',
      });
    });
  });

  describe('create Content Ads', () => {
    it('should return AdsResponse when promote content', async () => {
      const result = await appController.createCastAds(authorizer, {
        campaignMessage: 'test k',
        campaignName: 'test k',
        dailyBidType: AdsBidType.Auto,
        dailyBudget: 1,
        duration: 2,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.TOKEN_WALLET,
        contentId: contentPayload.payload.id,
        dailyBidValue: 1,
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
});
