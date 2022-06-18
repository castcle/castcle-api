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

import { MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { TransactionFilter, TransactionType, WalletType } from '../models';
import { MicroTransaction, TLedger, Transaction } from '../schemas';
import { CAccount } from '../schemas/caccount.schema';
import { TAccountService } from './taccount.service';

describe('TAccount Service', () => {
  let mongod: MongoMemoryReplSet;
  let service: TAccountService;
  let transactionModel: Model<Transaction>;
  let caccountModel: Model<CAccount>;
  const CHART_OF_ACCOUNT = {
    VAULT: {
      caccount: {} as CAccount,
      AIRDROP: {
        caccount: {} as CAccount,
      },
      TEAM: {
        caccount: {} as CAccount,
      },
    },
    MINTANDBURN: {
      caccount: {} as CAccount,
      DISTRIBUTED_AIRDROP: {
        caccount: {} as CAccount,
      },
      DISTRIBUTED_TEAM: {
        caccount: {} as CAccount,
      },
    },
  };
  let transactions: Transaction[];
  const mintValue = 1000;
  beforeAll(async () => {
    //create taccounts for mint, airdrop, referal
    //create taccounts for claim
    //create transactions
    mongod = await MongoMemoryReplSet.create();
    transactions = [];
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri(), { useCreateIndex: true }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [TAccountService],
    }).compile();
    service = module.get<TAccountService>(TAccountService);
    transactionModel = service._transactionModel;
    caccountModel = service._caccountModel;
    //create caccount for mint
    CHART_OF_ACCOUNT.VAULT.caccount = await new caccountModel({
      no: '0000',
      name: 'VAULT',
      nature: 'debit',
    }).save();
    CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount = await new caccountModel({
      no: '0100',
      parent: CHART_OF_ACCOUNT.VAULT.caccount._id,
      name: 'VAULT_AIRDROP',
      nature: 'debit',
    }).save();
    CHART_OF_ACCOUNT.VAULT.TEAM.caccount = await new caccountModel({
      no: '0200',
      parent: CHART_OF_ACCOUNT.VAULT.caccount._id,
      name: 'VAULT_TEAM',
      nature: 'debit',
    }).save();
    CHART_OF_ACCOUNT.MINTANDBURN.caccount = await new caccountModel({
      no: '7000',
      parent: CHART_OF_ACCOUNT.VAULT.caccount._id,
      name: 'MINT and burn',
      nature: 'credit',
    }).save();
    CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount =
      await new caccountModel({
        no: '7100',
        parent: CHART_OF_ACCOUNT.MINTANDBURN.caccount._id,
        name: 'Distrubute airdrop',
        nature: 'credit',
      }).save();
    CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_TEAM.caccount =
      await new caccountModel({
        no: '7200',
        parent: CHART_OF_ACCOUNT.MINTANDBURN.caccount._id,
        name: 'Distrubute team',
        nature: 'credit',
      }).save();
    //mint 1000 token to airdrop
    await caccountModel.updateOne(
      { _id: CHART_OF_ACCOUNT.VAULT.caccount._id },
      {
        $push: {
          child: {
            $each: [
              CHART_OF_ACCOUNT.VAULT.TEAM.caccount.no,
              CHART_OF_ACCOUNT.VAULT.AIRDROP.caccount.no,
            ],
          },
        },
      },
    );
    await caccountModel.updateOne(
      { _id: CHART_OF_ACCOUNT.MINTANDBURN.caccount._id },
      {
        $push: {
          child: {
            $each: [
              CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_AIRDROP.caccount.no,
              CHART_OF_ACCOUNT.MINTANDBURN.DISTRIBUTED_TEAM.caccount.no,
            ],
          },
        },
      },
    );

    transactions.push(
      await new transactionModel({
        from: {
          type: WalletType.CASTCLE_MINT_CONTRACT,
          value: mintValue,
        } as MicroTransaction,
        to: [
          {
            type: WalletType.CASTCLE_AIRDROP,
            value: mintValue,
          } as MicroTransaction,
        ],
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
          } as TLedger,
        ],
      }).save(),
    );
    transactions.push(
      await new transactionModel({
        from: {
          type: WalletType.CASTCLE_MINT_CONTRACT,
          value: mintValue,
        } as MicroTransaction,
        to: [
          {
            type: WalletType.CASTCLE_AIRDROP,
            value: mintValue,
          } as MicroTransaction,
        ],
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
          } as TLedger,
        ],
      }).save(),
    );
  });

  afterAll(async () => {
    await mongod.stop();
  });

  describe('getLedgers()', () => {
    it('should be ok', () => {
      expect(true).toEqual(true);
    });
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
    it('should be ok', () => {
      expect(true).toEqual(true);
    });
    it('should show correct child balance', async () => {
      expect(
        await service.getBalance(CHART_OF_ACCOUNT.VAULT.caccount.no),
      ).toEqual(mintValue * 2);
      expect(
        await service.getBalance(CHART_OF_ACCOUNT.MINTANDBURN.caccount.no),
      ).toEqual(mintValue * 2);
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
  describe('canSpend()', () => {
    it('should be ok', () => {
      expect(true).toEqual(true);
    });
  });
});
