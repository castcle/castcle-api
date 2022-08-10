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
  Campaign,
  CampaignSchema,
  CampaignStatus,
  CampaignType,
  EntityVisibility,
  FeedItem as Feed,
  FeedItemSchema,
  QueueName,
  Transaction,
  TransactionSchema,
  TransactionStatus,
  TransactionType,
  User,
  UserSchema,
  UserType,
  WalletType,
} from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { getQueueToken } from '@nestjs/bull';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { ClaimAirdropHandler } from './claim-airdrop.handler';

describe('ClaimAirdropHandler', () => {
  let handler: ClaimAirdropHandler;
  let moduleRef: TestingModule;
  let mongoServer: MongoMemoryReplSet;
  let campaignModel: Model<Campaign>;
  let feedModel: Model<Feed>;
  let transactionModel: Model<Transaction>;
  let userModel: Model<User>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        CqrsModule,
        MongooseModule.forRoot(mongoServer.getUri()),
        MongooseModule.forFeature([
          { name: Campaign.name, schema: CampaignSchema },
          { name: Feed.name, schema: FeedItemSchema },
          { name: Transaction.name, schema: TransactionSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [
        ClaimAirdropHandler,
        {
          provide: getQueueToken(QueueName.NEW_TRANSACTION),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    handler = moduleRef.get(ClaimAirdropHandler);
    campaignModel = moduleRef.get(getModelToken(Campaign.name));
    feedModel = moduleRef.get(getModelToken(Feed.name));
    transactionModel = moduleRef.get(getModelToken(Transaction.name));
    userModel = moduleRef.get(getModelToken(User.name));
  });

  afterAll(() => {
    return Promise.all([moduleRef.close(), mongoServer.stop()]);
  });

  afterEach(() => {
    return Promise.all([
      campaignModel.deleteMany(),
      feedModel.deleteMany(),
      transactionModel.deleteMany(),
      userModel.deleteMany(),
    ]);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should throw NOT_FOUND when campaign does not exist or expired', async () => {
    await expect(
      handler.execute({ campaign: new Types.ObjectId() }),
    ).rejects.toThrow(new CastcleException('CAMPAIGN_NOT_FOUND'));
  });

  it('should throw REWARD_IS_NOT_ENOUGH when reward is not enough to claim', async () => {
    const campaign = await new campaignModel({
      name: 'Early Caster Airdrop',
      type: CampaignType.VERIFY_MOBILE,
      startDate: new Date('2000-01-01T00:00Z'),
      endDate: new Date('3000-01-01T23:59Z'),
      maxClaims: 0,
      rewardsPerClaim: 10,
      rewardBalance: 0,
      totalRewards: 100_000,
    }).save();

    await expect(handler.execute({ campaign })).rejects.toThrow(
      new CastcleException('REWARD_IS_NOT_ENOUGH'),
    );
  });

  it('should throw REACHED_MAX_CLAIMS when user reaches maximum number of claims', async () => {
    const [campaignId, userId] = [new Types.ObjectId(), new Types.ObjectId()];
    const [campaign] = await Promise.all([
      new campaignModel({
        name: 'Early Caster Airdrop',
        type: CampaignType.VERIFY_MOBILE,
        startDate: new Date('2000-01-01T00:00Z'),
        endDate: new Date('3000-01-01T23:59Z'),
        maxClaims: 1,
        rewardsPerClaim: 10,
        rewardBalance: 100_000,
        totalRewards: 100_000,
      }).save(),
      new transactionModel({
        type: TransactionType.AIRDROP,
        status: TransactionStatus.PENDING,
        from: { type: WalletType.CASTCLE_AIRDROP, value: 10 },
        to: [{ type: WalletType.PERSONAL, value: 10, user: userId }],
        data: { campaign: campaignId },
      }).save(),
    ]);

    await expect(handler.execute({ campaign, user: userId })).rejects.toThrow(
      new CastcleException('REACHED_MAX_CLAIMS'),
    );
  });

  describe('claimContentReachAirdrop', () => {
    it('should throw CAMPAIGN_NOT_FOUND when status is completed', () => {
      new campaignModel({
        name: 'Early Caster Airdrop',
        type: CampaignType.CONTENT_REACH,
        startDate: new Date('2000-01-01T00:00Z'),
        endDate: new Date('3000-01-01T23:59Z'),
        maxClaims: 1,
        rewardsPerClaim: 10,
        rewardBalance: 100_000,
        totalRewards: 100_000,
        status: CampaignStatus.COMPLETED,
      }).save();
    });

    it('should throw CAMPAIGN_NOT_FOUND when campaign is running', () => {
      new campaignModel({
        name: 'Early Caster Airdrop',
        type: CampaignType.CONTENT_REACH,
        startDate: new Date('2000-01-01T00:00Z'),
        endDate: new Date('3000-01-01T23:59Z'),
        maxClaims: 1,
        rewardsPerClaim: 10,
        rewardBalance: 100_000,
        totalRewards: 100_000,
        status: CampaignStatus.CALCULATING,
      }).save();
    });

    it('should update campaign status to completed when no any content reach', async () => {
      const now = new Date();
      const campaign = await new campaignModel({
        visibility: EntityVisibility.Publish,
        type: CampaignType.CONTENT_REACH,
        status: CampaignStatus.CALCULATING,
        startDate: now,
        endDate: now,
        rewardBalance: 100_000,
      }).save();

      await handler.execute({ campaign });

      const [updatedCampaign, totalTransaction] = await Promise.all([
        campaignModel.findById(campaign._id),
        transactionModel.count(),
      ]);

      expect(totalTransaction).toEqual(0);
      expect(updatedCampaign.rewardBalance).toEqual(campaign.rewardBalance);
    });

    it('should update campaign status to completed and create transaction', async () => {
      const userDto = Array.from({ length: 3 }, (_, i) => ({
        displayId: i,
        displayName: i,
        ownerAccount: new Types.ObjectId(),
        type: UserType.PEOPLE,
      }));

      const now = new Date();
      const [campaign] = await Promise.all([
        new campaignModel({
          visibility: EntityVisibility.Publish,
          type: CampaignType.CONTENT_REACH,
          status: CampaignStatus.CALCULATING,
          startDate: now,
          endDate: now,
          rewardBalance: 100_000,
        }).save(),
        feedModel.create([
          { seenAt: now, viewer: userDto[0].ownerAccount },
          { seenAt: now, viewer: userDto[1].ownerAccount },
          { seenAt: now, viewer: userDto[2].ownerAccount },
        ]),
        userModel.create(userDto),
      ]);

      await handler.execute({ campaign });

      const [updatedCampaign, [{ isFromEqualToSumOfTo }]] = await Promise.all([
        campaignModel.findById(campaign._id),
        transactionModel.aggregate<{ isFromEqualToSumOfTo: boolean }>([
          {
            $project: {
              isFromEqualToSumOfTo: {
                $eq: ['$from.value', { $sum: '$to.value' }],
              },
            },
          },
        ]),
      ]);

      expect(Number(updatedCampaign.rewardBalance)).toEqual(0);
      expect(updatedCampaign.status).toEqual(CampaignStatus.COMPLETED);
      expect(isFromEqualToSumOfTo).toBeTruthy();
    });
  });
});
