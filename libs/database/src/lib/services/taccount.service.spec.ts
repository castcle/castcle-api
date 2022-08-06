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
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import {
  AnalyticService,
  AuthenticationServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  TAccountService,
} from '../database.module';
import { MockUserDetail, MockUserService, mockSend } from '../mocks';
import {
  KeywordType,
  QueueName,
  TopUpDto,
  TransactionFilter,
  TransactionType,
  WalletType,
} from '../models';
import { Repository } from '../repositories';
import { MicroTransaction, TLedger, Transaction } from '../schemas';
import { cAccount } from '../schemas/cAccount.schema';
describe('TAccount Service', () => {
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let service: TAccountService;
  let generateUser: MockUserService;
  let transactionModel: Model<Transaction>;
  let cAccountModel: Model<cAccount>;
  const CHART_OF_ACCOUNT = {
    VAULT: {
      cAccount: { _id: new Types.ObjectId(), no: '0000' } as cAccount,
      AIRDROP: {
        cAccount: { _id: new Types.ObjectId(), no: '0100' } as cAccount,
      },
      TEAM: {
        cAccount: { _id: new Types.ObjectId(), no: '0200' } as cAccount,
      },
    },
    MINT_AND_BURN: {
      cAccount: { _id: new Types.ObjectId(), no: '7000' } as cAccount,
      DISTRIBUTED_AIRDROP: {
        cAccount: { _id: new Types.ObjectId(), no: '7100' } as cAccount,
      },
      DISTRIBUTED_TEAM: {
        cAccount: { _id: new Types.ObjectId(), no: '7200' } as cAccount,
      },
    },
  };
  const transactions: Transaction[] = [];
  const mintValue = 1000;

  beforeAll(async () => {
    //create tAccounts for mint, airdrop, referral
    //create tAccounts for claim
    //create transactions
    mongod = await MongoMemoryReplSet.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        AuthenticationServiceV2,
        MockUserService,
        Repository,
        TAccountService,
        { provide: AnalyticService, useValue: {} },
        { provide: FacebookClient, useValue: {} },
        { provide: GoogleClient, useValue: {} },
        { provide: Mailer, useValue: {} },
        { provide: TwilioClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        {
          provide: getQueueToken(QueueName.VERIFY_EMAIL),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(TAccountService);
    generateUser = moduleRef.get(MockUserService);
    transactionModel = moduleRef.get(getModelToken('Transaction'));
    cAccountModel = moduleRef.get(getModelToken('cAccount'));

    // create cAccount for mint
    const cAccounts = await cAccountModel.create([
      {
        _id: CHART_OF_ACCOUNT.VAULT.cAccount._id,
        no: CHART_OF_ACCOUNT.VAULT.cAccount.no,
        name: 'VAULT',
        nature: 'debit',
        child: [
          CHART_OF_ACCOUNT.VAULT.TEAM.cAccount.no,
          CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount.no,
        ],
      },
      {
        _id: CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount._id,
        no: CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount.no,
        parent: CHART_OF_ACCOUNT.VAULT.cAccount._id,
        name: 'VAULT_AIRDROP',
        nature: 'debit',
      },
      {
        _id: CHART_OF_ACCOUNT.VAULT.TEAM.cAccount._id,
        no: CHART_OF_ACCOUNT.VAULT.TEAM.cAccount.no,
        parent: CHART_OF_ACCOUNT.VAULT.cAccount._id,
        name: 'VAULT_TEAM',
        nature: 'debit',
      },
      {
        _id: CHART_OF_ACCOUNT.MINT_AND_BURN.cAccount._id,
        no: CHART_OF_ACCOUNT.MINT_AND_BURN.cAccount.no,
        parent: CHART_OF_ACCOUNT.VAULT.cAccount._id,
        name: 'MINT and burn',
        nature: 'credit',
        child: [
          CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_AIRDROP.cAccount.no,
          CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_TEAM.cAccount.no,
        ],
      },
      {
        _id: CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_AIRDROP.cAccount._id,
        no: CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_AIRDROP.cAccount.no,
        parent: CHART_OF_ACCOUNT.MINT_AND_BURN.cAccount._id,
        name: 'Distribute airdrop',
        nature: 'credit',
      },
      {
        _id: CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_TEAM.cAccount._id,
        no: CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_TEAM.cAccount.no,
        parent: CHART_OF_ACCOUNT.MINT_AND_BURN.cAccount._id,
        name: 'Distribute team',
        nature: 'credit',
      },
    ]);

    CHART_OF_ACCOUNT.VAULT.cAccount = cAccounts[0];
    CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount = cAccounts[1];
    CHART_OF_ACCOUNT.VAULT.TEAM.cAccount = cAccounts[2];
    CHART_OF_ACCOUNT.MINT_AND_BURN.cAccount = cAccounts[3];
    CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_AIRDROP.cAccount = cAccounts[4];
    CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_TEAM.cAccount = cAccounts[5];

    transactions.push(
      ...(await transactionModel.create([
        {
          from: { type: WalletType.CASTCLE_MINT_CONTRACT, value: mintValue },
          to: [{ type: WalletType.CASTCLE_AIRDROP, value: mintValue }],
          ledgers: [
            {
              debit: {
                cAccountNo: CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount.no,
                value: mintValue,
              },
              credit: {
                cAccountNo:
                  CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_AIRDROP.cAccount
                    .no,
                value: mintValue,
              },
            },
          ],
        },
        {
          from: { type: WalletType.CASTCLE_MINT_CONTRACT, value: mintValue },
          to: [{ type: WalletType.CASTCLE_AIRDROP, value: mintValue }],
          ledgers: [
            {
              debit: {
                cAccountNo: CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount.no,
                value: mintValue,
              },
              credit: {
                cAccountNo:
                  CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_AIRDROP.cAccount
                    .no,
                value: mintValue,
              },
            },
          ],
        },
      ])),
    );
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('getLedgers()', () => {
    it('should get transactions that contain current ledgers', async () => {
      const txs = await service.getLedgers(
        CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount.no,
      );
      expect(txs.length).toEqual(transactions.length);
      expect(txs.map((tx) => tx.id)).toEqual(
        expect.arrayContaining(transactions.map((t) => t.id)),
      );
      //expect(txs[0].id).toBe (transactions.map(t => t.id));
      //expect(txs[1].id).toBeInstanceOf(transactions.map(t => t.id));
    });
    it('should get transactions that contain childs ledgers', async () => {
      const txs = await service.getLedgers(CHART_OF_ACCOUNT.VAULT.cAccount.no);
      expect(txs.length).toEqual(transactions.length);
      expect(txs.map((tx) => tx.id)).toEqual(
        expect.arrayContaining(transactions.map((t) => t.id)),
      );
      //expect(txs[0].id).toBe (transactions.map(t => t.id));
      //expect(txs[1].id).toBeInstanceOf(transactions.map(t => t.id));
    });
  });

  describe('getBalance()', () => {
    it('should show correct child balance', async () => {
      expect(true).toEqual(true);
      expect(
        await service.getBalance(CHART_OF_ACCOUNT.VAULT.cAccount.no),
      ).toEqual(mintValue * 2);
      // expect(
      //   await service.getBalance(CHART_OF_ACCOUNT.MINTANDBURN.cAccount.no),
      // ).toEqual(mintValue * 2);
    });
  });

  describe('getWalletHistory()', () => {
    it('should get wallet history', async () => {
      const depositValue = Types.Decimal128.fromString('10');
      const sendValue = Types.Decimal128.fromString('9');
      const fakeUserId = new Types.ObjectId();
      await new transactionModel({
        from: {
          type: WalletType.CASTCLE_MINT_CONTRACT,
          value: depositValue,
          user: fakeUserId,
        } as MicroTransaction,
        to: [
          {
            type: WalletType.CASTCLE_AIRDROP,
            value: depositValue,
          } as MicroTransaction,
        ],
        type: TransactionType.DEPOSIT,
        ledgers: [
          {
            debit: {
              cAccountNo: CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount.no,
              value: depositValue,
            },
            credit: {
              cAccountNo:
                CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_AIRDROP.cAccount.no,
              value: depositValue,
            },
          } as TLedger,
        ],
      }).save();
      await new transactionModel({
        from: {
          type: WalletType.CASTCLE_MINT_CONTRACT,
          value: sendValue,
        } as MicroTransaction,
        to: [
          {
            type: WalletType.CASTCLE_AIRDROP,
            value: sendValue,
            user: fakeUserId,
          } as MicroTransaction,
        ],
        type: TransactionType.DEPOSIT,
        ledgers: [
          {
            debit: {
              cAccountNo: CHART_OF_ACCOUNT.VAULT.AIRDROP.cAccount.no,
              value: sendValue,
            },
            credit: {
              cAccountNo:
                CHART_OF_ACCOUNT.MINT_AND_BURN.DISTRIBUTED_AIRDROP.cAccount.no,
              value: sendValue,
            },
          } as TLedger,
        ],
      }).save();
      const result = await service.getWalletHistory(
        fakeUserId.toString(),
        TransactionFilter.DEPOSIT_SEND,
      );
      const expectArr = [
        expect.objectContaining({
          type: TransactionType.DEPOSIT,
          /*  value: {
            $numberDecimal: `${sendValue}`
          },*/
        }),
        expect.objectContaining({
          type: TransactionType.DEPOSIT,
          /*value: {
            $numberDecimal: `${depositValue}`
          },*/
        }),
      ];
      expect(result.payload).toEqual(expect.arrayContaining(expectArr));
    });
  });
  describe('top up()', () => {
    let mockUserId;
    beforeAll(() => {
      mockUserId = new Types.ObjectId();
    });
    it('should be able top up ads account', async () => {
      await service.topUp({
        type: WalletType.ADS,
        value: 500,
        userId: String(mockUserId),
      } as TopUpDto);
      expect(
        await service.getAccountBalance(mockUserId, WalletType.ADS),
      ).toEqual(500);
    });
    it('should be able top up personal account', async () => {
      await service.topUp({
        type: WalletType.PERSONAL,
        value: 700,
        userId: String(mockUserId),
      } as TopUpDto);
      expect(
        await service.getAccountBalance(mockUserId, WalletType.PERSONAL),
      ).toEqual(700);
    });
  });

  describe('getAllWalletRecent()', () => {
    let mocksUsers: MockUserDetail[];

    beforeAll(async () => {
      mocksUsers = await generateUser.generateMockUsers(2);

      await mockSend(
        mocksUsers[0].user,
        mocksUsers[1].user,
        100,
        transactionModel,
      );
    });
    it('should get wallet recent list', async () => {
      const walletRecent = await service.getAllWalletRecent(
        mocksUsers[0].user._id,
      );

      expect(String(walletRecent.castcle[0].userId)).toEqual(
        String(mocksUsers[1].user.id),
      );
      expect(walletRecent.castcle[0].castcleId).toEqual(
        mocksUsers[1].user.displayId,
      );
    });

    it('should get wallet recent list by keyword', async () => {
      const walletRecent = await service.getAllWalletRecent(
        mocksUsers[0].user._id,
        {
          input: 'people_1',
          type: KeywordType.Word,
        },
      );

      expect(String(walletRecent.castcle[0].userId)).toEqual(
        String(mocksUsers[1].user.id),
      );
      expect(walletRecent.castcle[0].castcleId).toEqual(
        mocksUsers[1].user.displayId,
      );
    });

    it('should get wallet recent list is empty', async () => {
      const walletRecent = await service.getAllWalletRecent(
        mocksUsers[0].user._id,
        {
          input: 'test',
          type: KeywordType.Word,
        },
      );

      expect(walletRecent.castcle).toHaveLength(0);
    });
  });
});
