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
  CampaignType,
  Transaction,
  TransactionSchema,
  TransactionStatus,
  TransactionType,
  User,
  UserSchema,
  WalletType,
} from '@castcle-api/database';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { TransactionVerifier } from './transaction-verifier';

describe('TransactionVerifier', () => {
  let verifier: TransactionVerifier;
  let moduleRef: TestingModule;
  let mongoServer: MongoMemoryReplSet;
  let campaignModel: Model<Campaign>;
  let transactionModel: Model<Transaction>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoServer.getUri()),
        MongooseModule.forFeature([
          { name: Campaign.name, schema: CampaignSchema },
          { name: Transaction.name, schema: TransactionSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [TransactionVerifier],
    }).compile();

    verifier = moduleRef.get(TransactionVerifier);
    campaignModel = moduleRef.get(getModelToken(Campaign.name));
    transactionModel = moduleRef.get(getModelToken(Transaction.name));
  });

  afterAll(() => {
    return Promise.all([moduleRef.close(), mongoServer.stop()]);
  });

  afterEach(() => {
    return Promise.all([
      campaignModel.deleteMany(),
      transactionModel.deleteMany(),
    ]);
  });

  it('should be defined', () => {
    expect(verifier).toBeDefined();
  });

  describe('AirdropTransactionVerification', () => {
    it('should mark transaction as failed when some user wallet type does not have user ID', async () => {
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.AIRDROP,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.CASTCLE_AIRDROP, value: 10 },
          to: [{ type: WalletType.PERSONAL, value: 10 }],
          data: { campaign: new Types.ObjectId() },
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({
        status: TransactionStatus.FAILED,
        failureMessage: 'Invalid wallet type',
      });
    });

    it('should mark transaction as failed when total rewards !== sum of remaining and distributed rewards', async () => {
      const [campaignId, userId] = [new Types.ObjectId(), new Types.ObjectId()];
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.AIRDROP,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.CASTCLE_AIRDROP, value: 10 },
          to: [{ type: WalletType.PERSONAL, value: 10, user: userId }],
          data: { campaign: campaignId },
        }).save(),
        new campaignModel({
          _id: campaignId,
          name: 'Early Caster Airdrop',
          type: CampaignType.VERIFY_MOBILE,
          startDate: new Date('2000-01-01T00:00Z'),
          endDate: new Date('3000-01-01T23:59Z'),
          maxClaims: 1,
          rewardsPerClaim: 10,
          rewardBalance: 0,
          totalRewards: 100,
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({
        status: TransactionStatus.FAILED,
        failureMessage: 'Insufficient funds',
      });
    });

    it('should mark transaction as failed when transaction checksum is invalid', async () => {
      const [campaignId, userId] = [new Types.ObjectId(), new Types.ObjectId()];
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.AIRDROP,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.CASTCLE_AIRDROP, value: 10 },
          to: [{ type: WalletType.PERSONAL, value: 20, user: userId }],
          data: { campaign: campaignId },
        }).save(),
        new campaignModel({
          _id: campaignId,
          name: 'Early Caster Airdrop',
          type: CampaignType.VERIFY_MOBILE,
          startDate: new Date('2000-01-01T00:00Z'),
          endDate: new Date('3000-01-01T23:59Z'),
          maxClaims: 1,
          rewardsPerClaim: 10,
          rewardBalance: 90,
          totalRewards: 100,
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({
        status: TransactionStatus.FAILED,
        failureMessage: 'Invalid checksum',
      });
    });

    it('should verify transaction when transaction is valid', async () => {
      const [campaignId, userId] = [new Types.ObjectId(), new Types.ObjectId()];
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.AIRDROP,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.CASTCLE_AIRDROP, value: 10 },
          to: [{ type: WalletType.PERSONAL, value: 10, user: userId }],
          data: { campaign: campaignId },
        }).save(),
        new campaignModel({
          _id: campaignId,
          name: 'Early Caster Airdrop',
          type: CampaignType.VERIFY_MOBILE,
          startDate: new Date('2000-01-01T00:00Z'),
          endDate: new Date('3000-01-01T23:59Z'),
          maxClaims: 1,
          rewardsPerClaim: 10,
          rewardBalance: 90,
          totalRewards: 100,
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({ status: TransactionStatus.VERIFIED });
    });
  });

  describe('TransactionVerification', () => {
    it('should mark transaction as failed when some user wallet type does not have user ID', async () => {
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.SEND,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.PERSONAL, value: 10 },
          to: [{ type: WalletType.PERSONAL, value: 10 }],
          data: { campaign: new Types.ObjectId() },
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({
        status: TransactionStatus.FAILED,
        failureMessage: 'Invalid wallet type',
      });
    });

    it('should mark transaction as failed when user has no funds', async () => {
      const [userId, receiver] = [new Types.ObjectId(), new Types.ObjectId()];
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.SEND,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.PERSONAL, value: 10, user: userId },
          to: [{ type: WalletType.PERSONAL, value: 10, user: receiver }],
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({
        status: TransactionStatus.FAILED,
        failureMessage: 'Insufficient funds',
      });
    });

    it('should mark transaction as failed when available balance < value to send', async () => {
      const [userId, receiver] = [new Types.ObjectId(), new Types.ObjectId()];
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.SEND,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.PERSONAL, value: 20, user: userId },
          to: [{ type: WalletType.PERSONAL, value: 20, user: receiver }],
        }).save(),
        new transactionModel({
          type: TransactionType.AIRDROP,
          status: TransactionStatus.VERIFIED,
          from: { type: WalletType.CASTCLE_AIRDROP, value: 10 },
          to: [{ type: WalletType.PERSONAL, value: 10, user: userId }],
          data: { campaign: new Types.ObjectId() },
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({
        status: TransactionStatus.FAILED,
        failureMessage: 'Insufficient funds',
      });
    });

    it('should mark transaction as failed when transaction checksum is invalid', async () => {
      const [userId, receiver] = [new Types.ObjectId(), new Types.ObjectId()];
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.SEND,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.PERSONAL, value: 10, user: userId },
          to: [{ type: WalletType.PERSONAL, value: 5, user: receiver }],
        }).save(),
        new transactionModel({
          type: TransactionType.AIRDROP,
          status: TransactionStatus.VERIFIED,
          from: { type: WalletType.CASTCLE_AIRDROP, value: 10 },
          to: [{ type: WalletType.PERSONAL, value: 10, user: userId }],
          data: { campaign: new Types.ObjectId() },
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({
        status: TransactionStatus.FAILED,
        failureMessage: 'Invalid checksum',
      });
    });

    it('should verify transaction when transaction is valid', async () => {
      const [userId, receiver] = [new Types.ObjectId(), new Types.ObjectId()];
      const [tx] = await Promise.all([
        new transactionModel({
          type: TransactionType.SEND,
          status: TransactionStatus.PENDING,
          from: { type: WalletType.PERSONAL, value: 10, user: userId },
          to: [{ type: WalletType.PERSONAL, value: 10, user: receiver }],
        }).save(),
        new transactionModel({
          type: TransactionType.AIRDROP,
          status: TransactionStatus.VERIFIED,
          from: { type: WalletType.CASTCLE_AIRDROP, value: 10 },
          to: [{ type: WalletType.PERSONAL, value: 10, user: userId }],
          data: { campaign: new Types.ObjectId() },
        }).save(),
      ]);

      await expect(
        verifier.handleTransaction({ id: 1, data: tx } as Job<Transaction>),
      ).resolves.toMatchObject({ status: TransactionStatus.VERIFIED });
    });
  });
});
