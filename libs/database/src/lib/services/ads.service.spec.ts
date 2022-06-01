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
  DataService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  TAccountService,
} from '../database.module';
import { AdsQuery, AdsRequestDto, ContentType, ShortPayload } from '../dtos';
import { MockUserDetail, generateMockUsers } from '../mocks/user.mocks';
import {
  AdsBoostStatus,
  AdsCpm,
  AdsObjective,
  AdsPaymentMethod,
  AdsStatus,
  QueueName,
  WalletType,
} from '../models';
import { AdsCampaign, Content } from '../schemas';
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
  let dataService: DataService;

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
    dataService = app.get<DataService>(DataService);
    mocks = await generateMockUsers(2, 1, {
      accountService: authService,
      userService: userService,
    });
    promoteContent = await contentService.createContentFromUser(mocks[0].user, {
      castcleId: mocks[0].user.id,
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
            user: mocks[0].pages[0].id,
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
      const ads = await service.createAds(mocks[0].pages[0], adsIput);
      expect(ads.detail.dailyBudget).toEqual(adsIput.dailyBudget);
      expect(ads.detail.duration).toEqual(adsIput.duration);
      expect(ads.objective).toEqual(adsIput.objective);
      expect(ads.detail.message).toEqual(adsIput.campaignMessage);
      expect(ads.detail.name).toEqual(adsIput.campaignName);
      expect(ads.adsRef).not.toBeUndefined();
      expect(ads.adsRef.$id).toEqual(mocks[0].pages[0]._id);
    });
    it('should be able to create ads for promote contents', async () => {
      await new taccountService._transactionModel({
        from: {
          type: WalletType.CASTCLE_TREASURY,
          value: 999999,
        },
        to: [
          {
            user: mocks[0].user.id,
            type: WalletType.ADS,
            value: 999999,
          },
        ],
      }).save();
      const adsIput = {
        campaignName: 'Ads--2',
        campaignMessage: 'This is ads',
        contentId: promoteContent.id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const ads = await service.createAds(mocks[0].user, adsIput);
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
      const adsCampaigns = await service.getListAds(mocks[0].user, {
        maxResults: 100,
        filter: 'week',
        timezone: '+07:00',
      } as AdsQuery);

      expect(adsCampaigns.length).toBeGreaterThan(0);
      expect(String(adsCampaigns[0].owner)).toBe(String(mocks[0].user._id));
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
        paymentId: mocks[0].user.id,
      };
      const ads = await service.createAds(mocks[0].pages[0], adsInput);
      const adsCampaign = await service.lookupAds(
        mocks[0].pages[0]._id,
        ads._id,
      );

      expect(adsCampaign).toBeTruthy();
      expect(String(adsCampaign.owner)).toBe(String(mocks[0].pages[0]._id));
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
      const ads = await service.createAds(mocks[0].pages[0], adsInput);
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
      const ads = await service.createAds(mocks[0].pages[0], adsInput);
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
      const ads = await service.createAds(mocks[0].pages[0], adsInput);
      await service._adsCampaignModel.updateOne(
        { _id: ads._id },
        {
          $set: {
            status: AdsStatus.Approved,
          },
        },
      );

      await service.updateAdsBoostStatus(ads.id, AdsBoostStatus.Pause);
      const adsCampaign = await service._adsCampaignModel
        .findById(ads.id)
        .exec();

      expect(adsCampaign).toBeTruthy();
      expect(adsCampaign.boostStatus).toEqual(AdsBoostStatus.Pause);
    });
  });
  //follow unit test describe in https://docs.google.com/spreadsheets/d/1B-Gb0WcF791E_C73xxD8yDUK98R6StlAxGD7EF-5SJA/edit#gid=1524517584
  describe('#getAds', () => {
    const adsContents = [];
    const adsCampaigns: AdsCampaign[] = [];
    beforeAll(async () => {
      //remove all adsCampaign
      await service._adsCampaignModel.remove({});
      expect(await service._adsCampaignModel.count()).toEqual(0);
      const mockRelevanceScores = [
        0.1, 0.3, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.15, 0.22, 0.23, 0.34, 0.67,
        0.87,
      ];
      for (let i = 0; i < mockRelevanceScores.length; i++) {
        adsContents[i] = await contentService.createContentFromUser(
          mocks[0].user,
          {
            castcleId: mocks[0].pages[0].id,
            payload: {
              message: 'this is prmote short',
            } as ShortPayload,
            type: ContentType.Short,
          },
        );
      }
      const adsIput = {
        campaignName: 'cf1',
        campaignMessage: 'This is ads',
        contentId: adsContents[0].id,
        dailyBudget: 5,

        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const c1 = await service.createAds(mocks[0].user, adsIput);
      c1.status = AdsStatus.Approved;
      c1.boostStatus = AdsBoostStatus.Running;
      c1.statistics.dailySpent = 4.99;
      c1.markModified('statistics');
      adsCampaigns[0] = await c1.save();
      for (let i = 1; i < mockRelevanceScores.length - 1; i++) {
        adsCampaigns[i] = await service.createAds(mocks[0].user, {
          campaignName: 'cf2',
          campaignMessage: 'This is ads',
          contentId: adsContents[i].id,
          dailyBudget: 5,
          duration: 5,
          objective: AdsObjective.Engagement,
          paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        });
        adsCampaigns[i].status = AdsStatus.Approved;
        adsCampaigns[i].boostStatus = AdsBoostStatus.Running;
        await adsCampaigns[i].save();
      }

      const adsIputLast = {
        campaignName: 'cflast',
        campaignMessage: 'This is ads',
        contentId: adsContents[mockRelevanceScores.length - 1].id,
        dailyBudget: 5,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      };
      const cLast = await service.createAds(mocks[0].user, adsIputLast);
      cLast.statistics.dailySpent = 5;
      cLast.markModified('statistics');
      cLast.status = AdsStatus.Approved;
      cLast.boostStatus = AdsBoostStatus.Running;
      adsCampaigns[mockRelevanceScores.length - 1] = await cLast.save();
      const mockObj: { [key: string]: number } = {};
      mockRelevanceScores.forEach((item, index) => {
        mockObj[adsContents[index].id] = item;
      });
      console.log('///////////////// MOCK SCORE///////////');
      jest.spyOn(dataService, 'personalizeContents').mockResolvedValue(mockObj);
      console.log(
        await dataService.personalizeContents(mocks[1].account.id, []),
      );
    });
    describe('getAds', () => {
      it('should return bidding price of CPM(cost per thousand) as expect in google doc', async () => {
        const sortedCpms: AdsCpm[] = await service.getAds(mocks[1].account.id);
        const exptectedCPM = [
          expect.objectContaining({
            adsCampaignId: adsCampaigns[7].id,
            //bidding_cpm: 0.013
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[6].id,
            //bidding_cpm: 0.012
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[12].id,
            //bidding_cpm: 0.011
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[5].id,
            //bidding_cpm: 0.01
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[4].id,
            //bidding_cpm: 0.009
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[3].id,
            //bidding_cpm: 0.008
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[11].id,
            //bidding_cpm: 0.007
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[1].id,
            //bidding_cpm: 0.006
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[10].id,
            //bidding_cpm: 0.005
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[9].id,
            //bidding_cpm: 0.004
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[2].id,
            //bidding_cpm: 0.003
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[8].id,
            //bidding_cpm: 0.002
          }),
          expect.objectContaining({
            adsCampaignId: adsCampaigns[0].id,
            ///bidding_cpm: 0.001
          }),
        ];
        expect(sortedCpms).toEqual(expect.arrayContaining(exptectedCPM));
      });
    });
  });
  afterAll(() => {
    service._adsCampaignModel.deleteMany({});
    userService._accountModel.deleteMany({});
    userService._userModel.deleteMany({});
    contentService._contentModel.deleteMany({});
  });
});
