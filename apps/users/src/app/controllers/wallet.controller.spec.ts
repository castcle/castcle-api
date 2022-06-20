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
  AnalyticService,
  AuthenticationService,
  CampaignService,
  ContentService,
  GetShortcutParam,
  HashtagService,
  MicroTransaction,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  QueueName,
  ShortcutInternalDto,
  ShortcutSortDto,
  TAccountService,
  TLedger,
  TransactionFilter,
  TransactionType,
  UserService,
  UserServiceV2,
  WalletShortcutService,
  WalletType,
  generateMockUsers,
  mockDeposit,
} from '@castcle-api/database';
import { Mailer } from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { WalletResponse } from '../dtos';
import { WalletService } from '../services/wallet.service';
import { WalletController } from './wallet.controller';

describe('WalletController', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let appController: WalletController;
  let userServiceV1: UserService;
  let authService: AuthenticationService;
  let mocksUsers: MockUserDetail[];
  let taccountService: TAccountService;
  let walletShortcutService: WalletShortcutService;
  let shortcutId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CacheModule.register(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        HttpModule,
      ],
      controllers: [WalletController],
      providers: [
        AnalyticService,
        WalletShortcutService,
        AuthenticationService,
        ContentService,
        Repository,
        UserService,
        TAccountService,
        WalletService,
        UserServiceV2,
        { provide: CampaignService, useValue: {} },
        { provide: HashtagService, useValue: {} },
        { provide: Mailer, useValue: {} },
        { provide: NotificationService, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.CAMPAIGN),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get(WalletController);
    taccountService = app.get<TAccountService>(TAccountService);
    userServiceV1 = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    walletShortcutService = app.get<WalletShortcutService>(
      WalletShortcutService,
    );
    mocksUsers = await generateMockUsers(3, 0, {
      userService: userServiceV1,
      accountService: authService,
    });
    //init
    await mockDeposit(
      mocksUsers[0].user,
      5555,
      taccountService._transactionModel,
    );
  });

  describe('getUserWallet()', () => {
    it('should return user personal wallet', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
      const response = await appController.getUserWallet(authorizer, {
        userId: mocksUsers[0].user.id,
        isMe: () => true,
      });
      expect(response).toEqual({
        id: mocksUsers[0].user.id,
        farmBalance: 0,
        adsCredit: 0,
        availableBalance: 5555,
        totalBalance: 5555,
        castcleId: mocksUsers[0].user.displayId,
        displayName: mocksUsers[0].user.displayName,
      } as WalletResponse);
    });
  });
  describe('getUserHistory()', () => {
    it('should get user history', async () => {
      const fakeCACCOUNT = '12345';
      const depositValue = 10;
      const sendValue = 5;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        mocksUsers[1].user,
        mocksUsers[1].credential,
      );
      const fakeUserId = authorizer.user.id;
      const transactionModel = taccountService._transactionModel;
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
              caccountNo: fakeCACCOUNT,
              value: depositValue,
            },
            credit: {
              caccountNo: fakeCACCOUNT,
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
              caccountNo: fakeCACCOUNT,
              value: sendValue,
            },
            credit: {
              caccountNo: fakeCACCOUNT,
              value: sendValue,
            },
          } as TLedger,
        ],
      }).save();
      const result = await appController.getUserHistory(
        authorizer,
        {
          userId: mocksUsers[0].user.id,
          isMe: () => true,
        },
        {
          filter: TransactionFilter.DEPOSIT_SEND,
        },
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

  describe('createWalletShortcut', () => {
    it('should create wallet shortcut', async () => {
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        mocksUsers[1].user,
        mocksUsers[1].credential,
      );
      const payloadShortcut = await appController.createWalletShortcut(
        authorizer,
        {
          accountId: mocksUsers[1].account._id,
        },
        {
          chainId: 'castcle',
          userId: mocksUsers[0].user._id,
        } as ShortcutInternalDto,
      );

      shortcutId = payloadShortcut.id;

      expect(payloadShortcut.userId).toEqual(mocksUsers[0].user._id);
      expect(payloadShortcut.castcleId).toEqual(mocksUsers[0].user.displayId);
    });
  });

  describe('getWalletShortcut', () => {
    it('should create wallet shortcut', async () => {
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        mocksUsers[1].user,
        mocksUsers[1].credential,
      );

      const payloadShortcut = await appController.getWalletShortcut(
        authorizer,
        { accountId: mocksUsers[1].account._id },
      );

      expect(payloadShortcut.accounts).toHaveLength(1);
      expect(payloadShortcut.shortcuts).toHaveLength(1);
    });
  });

  describe('deleteWalletShortcut', () => {
    it('should delete wallet shortcut', async () => {
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        mocksUsers[1].user,
        mocksUsers[1].credential,
      );

      await appController.deleteWalletShortcut(authorizer, {
        accountId: mocksUsers[1].account._id,
        shortcutId,
      } as GetShortcutParam);

      const shortcut = await (
        walletShortcutService as any
      ).repository.findWallerShortcut({
        _id: shortcutId,
      });

      expect(shortcut).toBeNull();
    });
  });

  describe('sortWalletShortcut', () => {
    beforeAll(async () => {
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        mocksUsers[1].user,
        mocksUsers[1].credential,
      );
      await appController.createWalletShortcut(
        authorizer,
        {
          accountId: mocksUsers[1].account._id,
        },
        {
          chainId: 'castcle',
          userId: mocksUsers[0].user._id,
        } as ShortcutInternalDto,
      );

      await appController.createWalletShortcut(
        authorizer,
        {
          accountId: mocksUsers[1].account._id,
        },
        {
          chainId: 'castcle',
          userId: mocksUsers[2].user._id,
        } as ShortcutInternalDto,
      );
    });
    it('should update order wallet shortcut', async () => {
      const shortcuts = await (
        walletShortcutService as any
      ).repository.findWallerShortcuts({
        accountId: mocksUsers[1].account._id,
      });

      const sort = shortcuts.map((shortcut, index) => {
        return {
          id: shortcut._id,
          order: index++,
        };
      });

      const authorizer = new Authorizer(
        mocksUsers[1].account,
        mocksUsers[1].user,
        mocksUsers[1].credential,
      );

      await appController.sortWalletShortcut(
        authorizer,
        {
          accountId: mocksUsers[1].account._id,
        },
        { payload: sort } as ShortcutSortDto,
      );

      const newShortcuts = await (
        walletShortcutService as any
      ).repository.findWallerShortcuts({
        accountId: mocksUsers[1].account._id,
      });

      expect(newShortcuts).toHaveLength(2);
    });
  });

  afterAll(async () => {
    await Promise.all([app?.close(), mongod.stop()]);
  });
});
