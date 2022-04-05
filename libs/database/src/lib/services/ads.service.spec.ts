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

import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  TAccountService,
} from '../database.module';
import { AdsQuery, AdsRequestDto, ContentType, ShortPayload } from '../dtos';
import { generateMockUsers, MockUserDetail } from '../mocks/user.mocks';
import {
  AdsBoostStatus,
  AdsObjective,
  AdsPaymentMethod,
  AdsStatus,
  QueueName,
  WalletType,
} from '../models';
import { Content } from '../schemas';
import { AdsService } from './ads.service';
import { AuthenticationService } from './authentication.service';
import { UserService } from './user.service';

describe('AdsService', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: AdsService;
  let authService: AuthenticationService;
  let userService: UserService;
  let contentService: ContentService;
  let mocks: MockUserDetail[];
  let taccountService: TAccountService;
  let promoteContent: Content;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        AdsService,
        AuthenticationService,
        UserService,
        ContentService,
        TAccountService,
        HashtagService,
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
    service = app.get<AdsService>(AdsService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    userService = app.get<UserService>(UserService);
    contentService = app.get<ContentService>(ContentService);
    taccountService = app.get<TAccountService>(TAccountService);
    mocks = await generateMockUsers(2, 1, {
      accountService: authService,
      userService: userService,
    });
    promoteContent = await contentService.createContentFromUser(mocks[0].user, {
      castcleId: mocks[0].pages[0].id,
      payload: {
        message: 'this is prmote short',
      } as ShortPayload,
      type: ContentType.Short,
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
  describe('#createAds', () => {
    it('should be able to create ads for promote Page', async () => {
      await new taccountService._transactionModel({
        from: {
          type: WalletType.CASTCLE_TREASURY,
          value: 999999,
        },
        to: [
          {
            account: mocks[0].account,
            type: WalletType.ADS,
            value: 999999,
          },
        ],
      }).save();
      const adsIput = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        userId: mocks[0].pages[0].id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      } as AdsRequestDto;
      const ads = await service.createAds(mocks[0].account, adsIput);
      expect(ads.detail.dailyBudget).toEqual(adsIput.dailyBudget);
      expect(ads.detail.duration).toEqual(adsIput.duration);
      expect(ads.objective).toEqual(adsIput.objective);
      expect(ads.detail.message).toEqual(adsIput.campaignMessage);
      expect(ads.detail.name).toEqual(adsIput.campaignName);
      expect(ads.adsRef).not.toBeUndefined();
      expect(ads.adsRef.$id).toEqual(mocks[0].pages[0]._id);
    });
    it('should be able to create ads for promote contents', async () => {
      const adsIput = {
        campaignName: 'Ads2',
        campaignMessage: 'This is ads',
        contentId: promoteContent.id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const ads = await service.createAds(mocks[0].account, adsIput);
      expect(ads.detail.dailyBudget).toEqual(adsIput.dailyBudget);
      expect(ads.detail.duration).toEqual(adsIput.duration);
      expect(ads.objective).toEqual(adsIput.objective);
      expect(ads.detail.message).toEqual(adsIput.campaignMessage);
      expect(ads.detail.name).toEqual(adsIput.campaignName);
      expect(ads.adsRef).not.toBeUndefined();
      expect(ads.adsRef.$id).toEqual(promoteContent._id);
    });
  });
  describe('#listAds', () => {
    it('should be able to get list ads exist.', async () => {
      const adsCampaigns = await service.getListAds(mocks[0].account._id, {
        maxResults: 100,
        filter: 'week',
        timezone: '+07:00',
      } as AdsQuery);

      expect(adsCampaigns.length).toBeGreaterThan(0);
      expect(String(adsCampaigns[0].owner)).toBe(String(mocks[0].account._id));
    });
  });
  describe('#lookupAds', () => {
    it('should be able to get only one ads exist.', async () => {
      const adsInput = {
        campaignName: 'Ads',
        campaignMessage: 'This is ads',
        userId: mocks[0].pages[0].id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const ads = await service.createAds(mocks[0].account, adsInput);
      const adsCampaign = await service.lookupAds(
        mocks[0].account._id,
        ads._id
      );

      expect(adsCampaign).toBeTruthy();
      expect(String(adsCampaign.owner)).toBe(String(mocks[0].account._id));
    });
  });

  describe('#updateAds', () => {
    it('should be able update ads is correct.', async () => {
      const adsInput: AdsRequestDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        userId: mocks[0].pages[0].id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const adsUpdate: AdsRequestDto = {
        campaignName: 'Ads update',
        campaignMessage: 'This is ads',
        dailyBudget: 10,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const ads = await service.createAds(mocks[0].account, adsInput);
      await service.updateAdsById(ads.id, adsUpdate);
      const adsCampaign = await service._adsCampaignModel
        .findById(ads.id)
        .exec();

      expect(adsCampaign).toBeTruthy();
      expect(adsCampaign.detail.name).toEqual(adsUpdate.campaignName);
      expect(adsCampaign.detail.message).toEqual(adsUpdate.campaignMessage);
      expect(adsCampaign.detail.dailyBudget).toEqual(adsUpdate.dailyBudget);
      expect(adsCampaign.detail.duration).toEqual(adsUpdate.duration);
      expect(adsCampaign.objective).toEqual(adsUpdate.objective);
    });
  });
  describe('#deleteAds', () => {
    it('should be able delete ads is correct.', async () => {
      const adsInput: AdsRequestDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        userId: mocks[0].pages[0].id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const ads = await service.createAds(mocks[0].account, adsInput);
      await service.deleteAdsById(ads.id);
      const adsCampaign = await service._adsCampaignModel
        .findById(ads.id)
        .exec();

      expect(adsCampaign).toBeNull();
    });
  });
  describe('#updateAdsBoostStatus', () => {
    it('should be able update ads boost status.', async () => {
      const adsInput: AdsRequestDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        userId: mocks[0].pages[0].id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const ads = await service.createAds(mocks[0].account, adsInput);
      await service._adsCampaignModel.updateOne(
        { _id: ads._id },
        {
          $set: {
            status: AdsStatus.Approved,
          },
        }
      );

      await service.updateAdsBoostStatus(ads.id, AdsBoostStatus.Pause);
      const adsCampaign = await service._adsCampaignModel
        .findById(ads.id)
        .exec();

      expect(adsCampaign).toBeTruthy();
      expect(adsCampaign.boostStatus).toEqual(AdsBoostStatus.Pause);
    });
  });
  afterAll(() => {
    service._adsCampaignModel.deleteMany({});
    userService._accountModel.deleteMany({});
    userService._userModel.deleteMany({});
    contentService._contentModel.deleteMany({});
  });
});
