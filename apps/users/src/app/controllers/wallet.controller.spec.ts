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
  AuthenticationServiceV2,
  CampaignService,
  ContentService,
  HashtagService,
  MicroTransaction,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QueueName,
  TAccountService,
  TLedger,
  Transaction,
  TransactionFilter,
  TransactionType,
  UserService,
  UserServiceV2,
  WalletShortcutService,
  WalletType,
  generateMockUsers,
  mockDeposit,
} from '@castcle-api/database';
import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
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
  let transactionModel: Model<Transaction>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CacheModule.register(),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
      ],
      controllers: [WalletController],
      providers: [
        AnalyticService,
        AuthenticationService,
        AuthenticationServiceV2,
        ContentService,
        Repository,
        TAccountService,
        UserService,
        UserServiceV2,
        WalletService,
        WalletShortcutService,
        { provide: FacebookClient, useValue: {} },
        { provide: GoogleClient, useValue: {} },
        { provide: TwilioClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        { provide: CampaignService, useValue: {} },
        { provide: HashtagService, useValue: {} },
        { provide: Mailer, useValue: {} },
        { provide: NotificationServiceV2, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
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
        {
          provide: getQueueToken(QueueName.REPORTING),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get(WalletController);
    userServiceV1 = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    transactionModel = app.get(getModelToken('Transaction'));
    mocksUsers = await generateMockUsers(2, 0, {
      userService: userServiceV1,
      accountService: authService,
    });
    //init
    await mockDeposit(mocksUsers[0].user, 5555, transactionModel);
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

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
});
