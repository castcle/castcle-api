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

import { CastcleException } from '@castcle-api/utils/exception';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import {
  CampaignService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { CampaignType, QueueName } from '../models';
import { Repository } from '../repositories';
import { Campaign } from '../schemas';
import { TAccountService } from './taccount.service';

describe('Campaign Service', () => {
  let moduleRef: TestingModule;
  let mongo: MongoMemoryServer;
  let campaignService: CampaignService;
  let campaignModel: Model<Campaign>;
  const accountId = Types.ObjectId().toString();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
        MongooseModule.forRoot(mongo.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        CampaignService,
        TAccountService,
        Repository,
        {
          provide: getQueueToken(QueueName.CAMPAIGN),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    campaignService = moduleRef.get(CampaignService);
    campaignModel = moduleRef.get(getModelToken('Campaign'));
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongo.stop();
  });

  it('should be defined', () => {
    expect(campaignService).toBeDefined();
  });

  it('should return NOT_FOUND when campaign does not exist or expired', async () => {
    await expect(
      campaignService.claimCampaignsAirdrop(
        accountId,
        CampaignType.VERIFY_MOBILE,
      ),
    ).rejects.toThrow(new CastcleException('CAMPAIGN_HAS_NOT_STARTED'));
  });

  it('should return REWARD_IS_NOT_ENOUGH when reward is not enough to claim', async () => {
    const campaign = await new campaignModel({
      name: 'Early Caster Airdrop',
      type: CampaignType.VERIFY_MOBILE,
      startDate: new Date('2022-01-17T00:00Z'),
      endDate: new Date('3000-01-20T23:59Z'),
      maxClaims: 1,
      rewardsPerClaim: 10,
      rewardBalance: 0,
      totalRewards: 100_000,
    }).save();

    await expect(
      campaignService.claimCampaignsAirdrop(
        accountId,
        CampaignType.VERIFY_MOBILE,
      ),
    ).rejects.toThrow(new CastcleException('REWARD_IS_NOT_ENOUGH'));

    await campaign.deleteOne();
  });

  describe('Verify Mobile Campaign', () => {
    let campaign: Campaign;
    let claimAirdropResponse: void;

    beforeAll(async () => {
      campaign = await new campaignModel({
        name: 'Early Caster Airdrop',
        type: CampaignType.VERIFY_MOBILE,
        startDate: new Date('2022-01-17T00:00Z'),
        endDate: new Date('3000-01-20T23:59Z'),
        maxClaims: 1,
        rewardsPerClaim: 10,
        rewardBalance: 100_000,
        totalRewards: 100_000,
      }).save();

      claimAirdropResponse = await campaignService.claimCampaignsAirdrop(
        accountId,
        CampaignType.VERIFY_MOBILE,
      );
    });

    afterAll(async () => {
      await campaign.deleteOne();
    });

    it('should return NO_CONTENT when airdrop claim has been submitted successfully', async () => {
      expect(claimAirdropResponse).toBeUndefined();
    });

    it('should return REACHED_MAX_CLAIMS when user reached the maximum limit of claims', async () => {
      await expect(
        campaignService.claimCampaignsAirdrop(
          accountId,
          CampaignType.VERIFY_MOBILE,
        ),
      ).rejects.toThrow(new CastcleException('REACHED_MAX_CLAIMS'));
    });
  });

  describe('Friend Referral Campaign', () => {
    let campaign: Campaign;
    let claimAirdropResponse: void;

    beforeAll(async () => {
      campaign = await new campaignModel({
        name: 'Early Caster Airdrop',
        type: CampaignType.FRIEND_REFERRAL,
        startDate: new Date('2022-01-17T00:00Z'),
        endDate: new Date('3000-01-20T23:59Z'),
        maxClaims: 1,
        rewardsPerClaim: 10,
        rewardBalance: 100_000,
        totalRewards: 100_000,
      }).save();

      claimAirdropResponse = await campaignService.claimCampaignsAirdrop(
        accountId,
        CampaignType.FRIEND_REFERRAL,
      );
    });

    afterAll(async () => {
      await campaign.deleteOne();
    });

    it('should return NO_CONTENT when airdrop claim has been submitted successfully', async () => {
      expect(claimAirdropResponse).toBeUndefined();
    });

    it('should return REACHED_MAX_CLAIMS when user reached the maximum limit of claims', async () => {
      await expect(
        campaignService.claimCampaignsAirdrop(
          accountId,
          CampaignType.FRIEND_REFERRAL,
        ),
      ).rejects.toThrow(new CastcleException('REACHED_MAX_CLAIMS'));
    });
  });
});
