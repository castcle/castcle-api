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
  TopUpDto,
  TransactionFilter,
  TransactionType,
  WalletType,
} from '../models';
import { Repository } from '../repositories';
import { MicroTransaction, TLedger, Transaction } from '../schemas';
import { CAccount } from '../schemas/caccount.schema';
describe('TAccount Service', () => {
  let moduleRef: TestingModule;
  let mongod: MongoMemoryReplSet;
  let service: TAccountService;
  let generateUser: MockUserService;
  let transactionModel: Model<Transaction>;
  let cAccountModel: Model<CAccount>;
  const CHART_OF_ACCOUNT = {
    VAULT: {
      caccount: { _id: Types.ObjectId(), no: '0000' } as CAccount,
      AIRDROP: {
        caccount: { _id: Types.ObjectId(), no: '0100' } as CAccount,
      },
      TEAM: {
        caccount: { _id: Types.ObjectId(), no: '0200' } as CAccount,
      },
    },
    MINTANDBURN: {
      caccount: { _id: Types.ObjectId(), no: '7000' } as CAccount,
      DISTRIBUTED_AIRDROP: {
        caccount: { _id: Types.ObjectId(), no: '7100' } as CAccount,
      },
      DISTRIBUTED_TEAM: {
        caccount: { _id: Types.ObjectId(), no: '7200' } as CAccount,
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
      ],
    }).compile();

    service = moduleRef.get(TAccountService);
    generateUser = moduleRef.get(MockUserService);
    transactionModel = moduleRef.get(getModelToken('Transaction'));
    cAccountModel = moduleRef.get(getModelToken('CAccount'));

    // create caccount for mint
    const cAccounts = await cAccountModel.create([
      {
        _id: CHART_OF_ACCOUNT.VAULT.caccount._id,
        no: CHART_OF_ACCOUNT.VAULT.caccount.no,
        name: 'VAULT',
        nature: 'debit',
        child: [
          CHART_OF_ACCOUNT.VAULT.TEAM.caccount.no,
          CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount.no,
        ],
      },
      {
        _id: CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount._id,
        no: CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount.no,
        parent: CHART_OF_ACCOUNT.VAULT.caccount._id,
        name: 'VAULT_AIRDROP',
        nature: 'debit',
      },
      {
        _id: CHART_OF_ACCOUNT.VAULT.TEAM.caccount._id,
        no: CHART_OF_ACCOUNT.VAULT.TEAM.caccount.no,
        parent: CHART_OF_ACCOUNT.VAULT.caccount._id,
        name: 'VAULT_TEAM',
        nature: 'debit',
      },
      {
        _id: CHART_OF_ACCOUNT.MINTANDBURN.caccount._id,
        no: CHART_OF_ACCOUNT.MINTANDBURN.caccount.no,
        parent: CHART_OF_ACCOUNT.VAULT.caccount._id,
        name: 'MINT and burn',
        nature: 'credit',
        child: [
          CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount.no,
          CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_TEAM.caccount.no,
        ],
      },
      {
        _id: CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount._id,
        no: CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount.no,
        parent: CHART_OF_ACCOUNT.MINTANDBURN.caccount._id,
        name: 'Distribute airdrop',
        nature: 'credit',
      },
      {
        _id: CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_TEAM.caccount._id,
        no: CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_TEAM.caccount.no,
        parent: CHART_OF_ACCOUNT.MINTANDBURN.caccount._id,
        name: 'Distribute team',
        nature: 'credit',
      },
    ]);

    CHART_OF_ACCOUNT.VAULT.caccount = cAccounts[0];
    CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount = cAccounts[1];
    CHART_OF_ACCOUNT.VAULT.TEAM.caccount = cAccounts[2];
    CHART_OF_ACCOUNT.MINTANDBURN.caccount = cAccounts[3];
    CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount = cAccounts[4];
    CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_TEAM.caccount = cAccounts[5];

    transactions.push(
      ...(await transactionModel.create([
        {
          from: { type: WalletType.CASTCLE_MINT_CONTRACT, value: mintValue },
          to: [{ type: WalletType.CASTCLE_AIRDROP, value: mintValue }],
          ledgers: [
            {
              debit: {
                caccountNo: CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount.no,
                value: mintValue,
              },
              credit: {
                caccountNo:
                  CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount.no,
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
                caccountNo: CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount.no,
                value: mintValue,
              },
              credit: {
                caccountNo:
                  CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount.no,
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
        CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount.no,
      );
      expect(txs.length).toEqual(transactions.length);
      expect(txs.map((tx) => tx.id)).toEqual(
        expect.arrayContaining(transactions.map((t) => t.id)),
      );
      //expect(txs[0].id).toBe (transactions.map(t => t.id));
      //expect(txs[1].id).toBeInstanceOf(transactions.map(t => t.id));
    });
    it('should get transactions that contain childs ledgers', async () => {
      const txs = await service.getLedgers(CHART_OF_ACCOUNT.VAULT.caccount.no);
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
        await service.getBalance(CHART_OF_ACCOUNT.VAULT.caccount.no),
      ).toEqual(mintValue * 2);
      // expect(
      //   await service.getBalance(CHART_OF_ACCOUNT.MINTANDBURN.caccount.no),
      // ).toEqual(mintValue * 2);
    });
  });

  describe('getWalletHistory()', () => {
    it('should get wallet history', async () => {
      const depositValue = 10;
      const sendValue = 9;
      const fakeUserId = String(new Types.ObjectId());
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
        data: {
          type: TransactionType.DEPOSIT,
          filter: TransactionFilter.DEPOSIT_SEND,
        },
        ledgers: [
          {
            debit: {
              caccountNo: CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount.no,
              value: depositValue,
            },
            credit: {
              caccountNo:
                CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount.no,
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
        data: {
          type: TransactionType.SEND,
          filter: TransactionFilter.DEPOSIT_SEND,
        },
        ledgers: [
          {
            debit: {
              caccountNo: CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount.no,
              value: sendValue,
            },
            credit: {
              caccountNo:
                CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount.no,
              value: sendValue,
            },
          } as TLedger,
        ],
      }).save();
      const result = await service.getWalletHistory(
        fakeUserId,
        TransactionFilter.DEPOSIT_SEND,
      );
      const expectArr = [
        expect.objectContaining({
          type: TransactionType.SEND,
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
      mockUserId = Types.ObjectId();
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
