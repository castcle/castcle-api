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
import { TestingModule } from '@castcle-api/testing';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { CreatedUser } from 'libs/testing/src/lib/testing.dto';
import { Model, Types } from 'mongoose';
import {
  ContentService,
  DataService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  TAccountService,
} from '../database.module';
import { AdsQuery, AdsRequestDto, ShortPayload } from '../dtos';
import {
  AdsBidType,
  AdsBoostStatus,
  AdsCpm,
  AdsObjective,
  AdsPaymentMethod,
  AdsSocialReward,
  AdsStatus,
  CAccountNo,
  ContentType,
  QueueName,
  WalletType,
} from '../models';
import { Repository } from '../repositories';
import {
  AdsCampaign,
  AdsPlacement,
  Content,
  Transaction,
  cAccount,
} from '../schemas';
import { AdsService } from './ads.service';

describe('AdsService', () => {
  let moduleRef: TestingModule;
  let service: AdsService;
  let contentService: ContentService;
  let mocks: CreatedUser[];
  let adsCampaignModel: Model<AdsCampaign>;
  let cAccountModel: Model<cAccount>;
  let transactionModel: Model<Transaction>;
  let promoteContent: Content;
  let dataService: DataService;
  let tAccountService: TAccountService;

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
        AdsService,
        ContentService,
        TAccountService,
        HashtagService,
        Repository,
        NotificationServiceV2,
        {
          provide: DataService,
          useValue: {
            personalizeContents: (_: string, contentIds: string[]) => ({
              [contentIds[0]]: 4,
            }),
          },
        },
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
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    });

    service = moduleRef.get(AdsService);
    contentService = moduleRef.get(ContentService);
    dataService = moduleRef.get(DataService);
    tAccountService = moduleRef.get(TAccountService);
    transactionModel = moduleRef.getModel('Transaction');
    cAccountModel = moduleRef.getModel('cAccount');
    adsCampaignModel = moduleRef.getModel('AdsCampaign');

    mocks = await Promise.all([
      moduleRef.createUser({ pageSize: 1 }),
      moduleRef.createUser(),
    ]);

    promoteContent = await contentService.createContentFromUser(mocks[0].user, {
      castcleId: mocks[0].user.id,
      payload: { message: 'this is promote short' } as ShortPayload,
      type: ContentType.Short,
    });
  });

  afterAll(() => {
    return moduleRef.close();
  });

  describe('#createAds', () => {
    it('should be able to create ads for promote Page', async () => {
      await new transactionModel({
        from: {
          type: WalletType.EXTERNAL_DEPOSIT,
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
      const adDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        castcleId: mocks[0].pages[0].displayId,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
      } as AdsRequestDto;
      const ads = await service.createAds(mocks[0].pages[0], adDto);
      expect(ads.dailyBudget).toEqual(adDto.dailyBudget);
      expect(ads.duration).toEqual(adDto.duration);
      expect(ads.objective).toEqual(adDto.objective);
      expect(ads.campaignMessage).toEqual(adDto.campaignMessage);
      expect(ads.campaignName).toEqual(adDto.campaignName);
      expect(ads.payload).not.toBeUndefined();
      expect(ads.payload.id).toEqual(mocks[0].pages[0].id);
    });

    it('should be able to create ads for promote contents', async () => {
      await new transactionModel({
        from: {
          type: WalletType.EXTERNAL_DEPOSIT,
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
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      } as AdsRequestDto;
      const ads = await service.createAds(mocks[0].user, adsIput);
      expect(ads.dailyBudget).toEqual(adsIput.dailyBudget);
      expect(ads.duration).toEqual(adsIput.duration);
      expect(ads.objective).toEqual(adsIput.objective);
      expect(ads.campaignMessage).toEqual(adsIput.campaignMessage);
      expect(ads.campaignName).toEqual(adsIput.campaignName);
      expect(ads.payload).not.toBeUndefined();
      expect(ads.payload.id).toEqual(promoteContent.id);
    });
  });
  describe('#listAds', () => {
    it('should be able to get list ads exist.', async () => {
      const adsCampaigns = await service.getListAds(mocks[0].user, {
        maxResults: 100,
        filter: 'week',
        timezone: '+07:00',
      } as AdsQuery);

      expect(adsCampaigns.payload.length).toBeGreaterThan(0);
      expect(String((adsCampaigns.payload[0].payload as any).authorId)).toBe(
        String(mocks[0].user.id),
      );
    });
  });
  describe('#lookupAds', () => {
    it('should be able to get only one ads exist.', async () => {
      const adsInput = {
        campaignName: 'Ads',
        campaignMessage: 'This is ads',
        castcleId: mocks[0].pages[0].displayId,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        paymentId: mocks[0].user.id,
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const ads = await service.createAds(mocks[0].pages[0], adsInput);
      const adsCampaign = await service.lookupAds(
        mocks[0].pages[0]._id,
        ads.id,
      );

      expect(adsCampaign).toBeTruthy();
      expect(String(adsCampaign.payload.id)).toBe(
        String(mocks[0].pages[0]._id),
      );
    });
  });

  describe('#updateAds', () => {
    it('should be able update ads is correct.', async () => {
      const adsInput: AdsRequestDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        castcleId: mocks[0].pages[0].displayId,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const adsUpdate: AdsRequestDto = {
        campaignName: 'Ads update',
        campaignMessage: 'This is ads',
        dailyBudget: 10,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const ads = await service.createAds(mocks[0].pages[0], adsInput);
      await service.updateAdsById(ads.id, adsUpdate);
      const adsCampaign = await adsCampaignModel.findById(ads.id).exec();

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
        castcleId: mocks[0].pages[0].displayId,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const ads = await service.createAds(mocks[0].pages[0], adsInput);
      await service.deleteAdsById(ads.id);
      const adsCampaign = await adsCampaignModel.findById(ads.id).exec();

      expect(adsCampaign).toBeNull();
    });
  });

  describe('#adsRunning', () => {
    it('should be able update ads is correct.', async () => {
      const adsInput: AdsRequestDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        castcleId: mocks[0].pages[0].displayId,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const ads = await service.createAds(mocks[0].pages[0], adsInput);

      const adCampaign1 = await adsCampaignModel.findById(ads.id).exec();

      await service.approveAd(ads.id);
      await service.adsPause(adCampaign1);

      const adsCampaign = await adsCampaignModel.findById(ads.id).exec();

      expect(adsCampaign.boostStatus).toEqual(AdsBoostStatus.Pause);

      await service.adsRunning(adsCampaign);
      const adsCampaign1 = await adsCampaignModel.findById(ads.id).exec();

      expect(adsCampaign1.boostStatus).toEqual(AdsBoostStatus.Running);
      expect(adsCampaign1.pauseInterval).toHaveLength(1);
    });
  });

  describe('#adsPause', () => {
    it('should be able update ads is correct.', async () => {
      const adsInput: AdsRequestDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        castcleId: mocks[0].pages[0].displayId,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const ads = await service.createAds(mocks[0].pages[0], adsInput);

      const adCampaign1 = await adsCampaignModel.findById(ads.id).exec();

      await service.approveAd(ads.id);
      await service.adsPause(adCampaign1);

      const adsCampaign = await adsCampaignModel.findById(ads.id).exec();

      expect(adsCampaign.boostStatus).toEqual(AdsBoostStatus.Pause);
      expect(adsCampaign.pauseInterval).toHaveLength(1);
    });
  });

  describe('#updateAdsBoostStatus', () => {
    it('should be able update ads boost status.', async () => {
      const adsInput: AdsRequestDto = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        castcleId: mocks[0].pages[0].displayId,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
        paymentMethod: AdsPaymentMethod.ADS_CREDIT,
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const ads = await service.createAds(mocks[0].pages[0], adsInput);
      await adsCampaignModel.updateOne(
        { _id: ads.id },
        {
          $set: {
            status: AdsStatus.Approved,
          },
        },
      );

      await service.updateAdsBoostStatus(ads.id, AdsBoostStatus.Pause);
      const adsCampaign = await adsCampaignModel.findById(ads.id).exec();

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
      await adsCampaignModel.deleteMany({});
      expect(await adsCampaignModel.countDocuments()).toEqual(0);
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
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const c1 = await service.createAds(mocks[0].user, adsIput);

      const ad1 = await adsCampaignModel.findOne({
        _id: new Types.ObjectId(c1.id),
      });

      ad1.status = AdsStatus.Approved;
      ad1.boostStatus = AdsBoostStatus.Running;
      ad1.statistics.dailySpent = 4.99;
      ad1.markModified('statistics');
      adsCampaigns[0] = await ad1.save();
      for (let i = 1; i < mockRelevanceScores.length - 1; i++) {
        await service.createAds(mocks[0].user, {
          campaignName: 'cf2',
          campaignMessage: 'This is ads',
          contentId: adsContents[i].id,
          dailyBudget: 5,
          duration: 5,
          objective: AdsObjective.Engagement,
          paymentMethod: AdsPaymentMethod.ADS_CREDIT,
          dailyBidType: AdsBidType.Auto,
          dailyBidValue: 1,
        });

        adsCampaigns[i] = await adsCampaignModel.findOne({
          _id: new Types.ObjectId(c1.id),
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
        dailyBidType: AdsBidType.Auto,
        dailyBidValue: 1,
      };
      const cLast = await service.createAds(mocks[0].user, adsIputLast);
      const ad2 = await adsCampaignModel.findOne({ _id: cLast.id });
      ad2.status = AdsStatus.Approved;
      ad2.boostStatus = AdsBoostStatus.Running;
      ad2.statistics.dailySpent = 4.99;
      ad2.markModified('statistics');
      adsCampaigns[mockRelevanceScores.length - 1] = await ad2.save();
      const mockObj: { [key: string]: number } = {};
      mockRelevanceScores.forEach((item, index) => {
        mockObj[adsContents[index].id] = item;
      });
      jest.spyOn(dataService, 'personalizeContents').mockResolvedValue(mockObj);
      await dataService.personalizeContents(mocks[1].account.id, []);
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

  describe('Distribute Reward cases', () => {
    beforeAll(async () => {
      const socialReward = await new cAccountModel({
        no: CAccountNo.SOCIAL_REWARD.NO,
        name: 'SOCIAL_REWARD',
        nature: 'credit',
        child: [
          CAccountNo.SOCIAL_REWARD.ADS_CREDIT.NO,
          CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
        ],
      }).save();
      await cAccountModel.insertMany([
        {
          no: CAccountNo.SOCIAL_REWARD.ADS_CREDIT.NO,
          name: 'SOCIAL_REWARD.ADS_CREDIT',
          nature: 'credit',
          parent: socialReward._id,
          child: [],
        },
        {
          no: CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
          name: 'SOCIAL_REWARD.PERSONAL',
          nature: 'credit',
          parent: socialReward._id,
          child: [],
        },
      ]);
      const liability = await new cAccountModel({
        no: CAccountNo.LIABILITY.NO,
        name: 'LIABILITY',
        nature: 'credit',
        child: [
          CAccountNo.LIABILITY.USER_WALLET.ADS,
          CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
        ],
      }).save();
      await cAccountModel.insertMany([
        {
          no: CAccountNo.LIABILITY.USER_WALLET.ADS,
          name: 'LIABILITY.ADS_CREDIT',
          nature: 'credit',
          parent: liability._id,
          child: [],
        },
        {
          no: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
          name: 'LIABILITY.PERSONAL',
          nature: 'credit',
          parent: liability._id,
          child: [],
        },
      ]);
    });
    describe('distributeAdsReward()', () => {
      describe('distributeContentFarmingReward()', () => {
        it('should distribute reward to content creator if no content farming', async () => {
          const authors = [
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
          ];
          const newContents = authors.map((author) => ({
            authorId: author,
            contentId: new Types.ObjectId(),
          }));
          const campaign = new Types.ObjectId();
          const viewer = new Types.ObjectId();
          const topupValue = 100;
          await new transactionModel({
            from: {
              type: WalletType.EXTERNAL_DEPOSIT,
              value: topupValue,
            },
            to: [
              {
                type: WalletType.CASTCLE_SOCIAL,
                value: topupValue,
              },
            ],
            ledgers: [
              {
                credit: {
                  cAccountNo: CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
                  value: topupValue,
                },
                debit: {
                  cAccountNo: CAccountNo.ASSET.CASTCLE_DEPOSIT,
                  value: topupValue,
                },
              },
            ],
          }).save();
          const balance = await tAccountService.getBalance(
            CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
          );
          expect(balance).toEqual(topupValue);
          const session = await transactionModel.startSession();
          const reward = {
            adsCost: 100,
            castcleShare: 30,
            farmingShare: 35,
            creatorShare: 21,
            viewerShare: 14,
          } as AdsSocialReward;
          await service.distributeContentFarmingReward(
            {
              contents: newContents,
              cost: {
                UST: 50,
              },
              campaign: {
                campaignId: campaign,
                campaignPaymentType: AdsPaymentMethod.TOKEN_WALLET,
              },
              user: viewer,
            } as any as AdsPlacement,
            reward,
            session,
          );
          const newBalance = await tAccountService.getBalance(
            CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
          );
          expect(newBalance).not.toEqual(topupValue);
          for (let i = 0; i < authors.length; i++) {
            const authorBalance = await tAccountService.getAccountBalance(
              String(authors[i]),
              WalletType.PERSONAL,
            );
            expect(authorBalance).toEqual(reward.farmingShare / authors.length);
          }
        });
      });
      describe('distributeContentCreatorReward()', () => {
        it('should distrubute author reward', async () => {
          const authors = [
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
          ];
          const newContents = authors.map((author) => ({
            authorId: author,
            contentId: new Types.ObjectId(),
          }));
          const campaign = new Types.ObjectId();
          const viewer = new Types.ObjectId();
          const topupValue = 100;
          await transactionModel.deleteMany({});
          await new transactionModel({
            from: {
              type: WalletType.EXTERNAL_DEPOSIT,
              value: topupValue,
            },
            to: [
              {
                type: WalletType.CASTCLE_SOCIAL,
                value: topupValue,
              },
            ],
            ledgers: [
              {
                credit: {
                  cAccountNo: CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
                  value: topupValue,
                },
                debit: {
                  cAccountNo: CAccountNo.ASSET.CASTCLE_DEPOSIT,
                  value: topupValue,
                },
              },
            ],
          }).save();
          const balance = await tAccountService.getBalance(
            CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
          );
          expect(balance).toEqual(topupValue);
          const session = await transactionModel.startSession();
          const reward = {
            adsCost: 100,
            castcleShare: 30,
            farmingShare: 35,
            creatorShare: 21,
            viewerShare: 14,
          } as AdsSocialReward;
          await service.distributeContentCreatorReward(
            {
              contents: newContents,
              cost: {
                UST: 50,
              },
              campaign: {
                campaignId: campaign,
                campaignPaymentType: AdsPaymentMethod.TOKEN_WALLET,
              },
              user: viewer,
            } as any as AdsPlacement,
            reward,
            session,
          );
          const newBalance = await tAccountService.getBalance(
            CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
          );
          expect(newBalance).not.toEqual(topupValue);
          for (let i = 0; i < authors.length; i++) {
            const authorBalance = await tAccountService.getAccountBalance(
              String(authors[i]),
              WalletType.PERSONAL,
            );
            expect(authorBalance).toEqual(reward.creatorShare / authors.length);
          }
        });
      });
      describe('distributeViewerReward()', () => {
        it('should distribute to viewer', async () => {
          const authors = [
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
            new Types.ObjectId(),
          ];
          const newContents = authors.map((author) => ({
            authorId: author,
            contentId: new Types.ObjectId(),
          }));
          const campaign = new Types.ObjectId();
          const viewer = new Types.ObjectId();
          const topupValue = 100;
          await transactionModel.deleteMany({});
          await new transactionModel({
            from: {
              type: WalletType.EXTERNAL_DEPOSIT,
              value: topupValue,
            },
            to: [
              {
                type: WalletType.CASTCLE_SOCIAL,
                value: topupValue,
              },
            ],
            ledgers: [
              {
                credit: {
                  cAccountNo: CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
                  value: topupValue,
                },
                debit: {
                  cAccountNo: CAccountNo.ASSET.CASTCLE_DEPOSIT,
                  value: topupValue,
                },
              },
            ],
          }).save();
          const balance = await tAccountService.getBalance(
            CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
          );
          expect(balance).toEqual(topupValue);
          const session = await transactionModel.startSession();
          const reward = {
            adsCost: 100,
            castcleShare: 30,
            farmingShare: 35,
            creatorShare: 21,
            viewerShare: 14,
          } as AdsSocialReward;
          await service.distributeViewerReward(
            {
              contents: newContents,
              cost: {
                UST: 50,
              },
              campaign: {
                campaignId: campaign,
                campaignPaymentType: AdsPaymentMethod.TOKEN_WALLET,
              },
              user: viewer,
            } as any as AdsPlacement,
            reward,
            session,
          );
          const viewerBalance = await tAccountService.getAccountBalance(
            String(viewer),
            WalletType.PERSONAL,
          );
          expect(viewerBalance).toEqual(reward.viewerShare);
          const newBalance = await tAccountService.getBalance(
            CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
          );
          expect(newBalance).not.toEqual(topupValue);
        });
      });

      it('should distribute all rewards to all counter parties', async () => {
        const authors = [
          new Types.ObjectId(),
          new Types.ObjectId(),
          new Types.ObjectId(),
          new Types.ObjectId(),
          new Types.ObjectId(),
        ];
        const newContents = authors.map((author) => ({
          authorId: author,
          contentId: new Types.ObjectId(),
        }));
        const campaign = new Types.ObjectId();
        const viewer = new Types.ObjectId();
        const topupValue = 100;
        await transactionModel.deleteMany({});
        await new transactionModel({
          from: {
            type: WalletType.EXTERNAL_DEPOSIT,
            value: topupValue,
          },
          to: [
            {
              type: WalletType.CASTCLE_SOCIAL,
              value: topupValue,
            },
          ],
          ledgers: [
            {
              credit: {
                cAccountNo: CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
                value: topupValue,
              },
              debit: {
                cAccountNo: CAccountNo.ASSET.CASTCLE_DEPOSIT,
                value: topupValue,
              },
            },
          ],
        }).save();
        const balance = await tAccountService.getBalance(
          CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
        );
        expect(balance).toEqual(topupValue);
        const session = await transactionModel.startSession();
        const reward = {
          adsCost: 100,
          castcleShare: 30,
          farmingShare: 35,
          creatorShare: 21,
          viewerShare: 14,
        } as AdsSocialReward;
        await service.distributeAdsReward(
          {
            contents: newContents,
            cost: {
              UST: 50,
            },
            campaign: {
              campaignId: campaign,
              campaignPaymentType: AdsPaymentMethod.TOKEN_WALLET,
            },
            user: viewer,
          } as any as AdsPlacement,
          reward,
          session,
        );
        const newBalance = await tAccountService.getBalance(
          CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
        );
        expect(newBalance).not.toEqual(topupValue);
        const viewerBalance = await tAccountService.getAccountBalance(
          String(viewer),
          WalletType.PERSONAL,
        );
        expect(viewerBalance).toEqual(reward.viewerShare);
        for (let i = 0; i < authors.length; i++) {
          const authorBalance = await tAccountService.getAccountBalance(
            String(authors[i]),
            WalletType.PERSONAL,
          );
          expect(authorBalance).toEqual(
            (reward.creatorShare + reward.farmingShare) / authors.length,
          );
        }
      });
    });
  });
});
