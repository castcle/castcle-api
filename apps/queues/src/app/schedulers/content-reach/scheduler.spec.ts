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

import { CastcleLogger } from '@castcle-api/common';
import {
  Campaign,
  CampaignSchema,
  CampaignStatus,
  CampaignType,
  EntityVisibility,
  FeedItemV2 as Feed,
  FeedItemV2Schema,
  QueueName,
  Transaction,
  TransactionSchema,
  User,
  UserSchema,
  UserType,
} from '@castcle-api/database';
import { CastcleMongooseModule } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { getQueueToken } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { ContentReachScheduler } from './scheduler';

type Scheduler = {
  logger: CastcleLogger;
  txQueue: Queue<Transaction>;
  handle(): Promise<void>;
  claimContentReachAirdrop(campaign: Campaign): Promise<void>;
};

describe('ClaimAirdropHandler', () => {
  let moduleRef: TestingModule;
  let scheduler: Scheduler;
  let campaignModel: Model<Campaign>;
  let feedModel: Model<Feed>;
  let transactionModel: Model<Transaction>;
  let userModel: Model<User>;

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CastcleMongooseModule,
        MongooseModule.forFeature([
          { name: 'Campaign', schema: CampaignSchema },
          { name: 'FeedItemV2', schema: FeedItemV2Schema },
          { name: 'Transaction', schema: TransactionSchema },
          { name: 'User', schema: UserSchema },
        ]),
      ],
      providers: [
        ContentReachScheduler,
        {
          provide: getQueueToken(QueueName.NEW_TRANSACTION),
          useValue: { add: jest.fn() },
        },
      ],
    });

    scheduler = moduleRef.get(ContentReachScheduler) as unknown as Scheduler;
    campaignModel = moduleRef.getModel('Campaign');
    feedModel = moduleRef.getModel('FeedItemV2');
    transactionModel = moduleRef.getModel('Transaction');
    userModel = moduleRef.getModel('User');
  });

  afterAll(() => {
    return moduleRef.close();
  });

  afterEach(() => {
    return moduleRef.cleanDb();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('should return void when campaign does not exist or expired', async () => {
    const _claimContentReachAirdrop = scheduler.claimContentReachAirdrop;
    scheduler.claimContentReachAirdrop = jest.fn();
    await expect(scheduler.handle()).resolves.toBeUndefined();
    expect(scheduler.claimContentReachAirdrop).not.toBeCalled();
    expect(scheduler.logger.log).not.toBeCalled();
    scheduler.claimContentReachAirdrop = _claimContentReachAirdrop;
  });

  it('should return void when status is completed', async () => {
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

    const _claimContentReachAirdrop = scheduler.claimContentReachAirdrop;
    scheduler.claimContentReachAirdrop = jest.fn();
    await expect(scheduler.handle()).resolves.toBeUndefined();
    expect(scheduler.claimContentReachAirdrop).not.toBeCalled();
    expect(scheduler.logger.log).not.toBeCalled();
    scheduler.claimContentReachAirdrop = _claimContentReachAirdrop;
  });

  it('should return void when campaign is running', async () => {
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

    const _claimContentReachAirdrop = scheduler.claimContentReachAirdrop;
    scheduler.claimContentReachAirdrop = jest.fn();
    await expect(scheduler.handle()).resolves.toBeUndefined();
    expect(scheduler.claimContentReachAirdrop).not.toBeCalled();
    expect(scheduler.logger.log).not.toBeCalled();
    scheduler.claimContentReachAirdrop = _claimContentReachAirdrop;
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

    await expect(scheduler.handle()).resolves.toBeUndefined();

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

    await expect(scheduler.handle()).resolves.toBeUndefined();

    const [updatedCampaign, transactions, [{ isFromEqualToSumOfTo }]] =
      await Promise.all([
        campaignModel.findById(campaign._id),
        transactionModel.find(),
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
    expect(transactions.length).toEqual(1);
    expect(updatedCampaign.status).toEqual(CampaignStatus.COMPLETED);
    expect(isFromEqualToSumOfTo).toBeTruthy();
  });
});
