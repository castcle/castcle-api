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
  HashtagService,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QueueName,
  TAccountService,
  UserService,
  UserServiceV2,
  WalletShortcutService,
  generateMockUsers,
  mockDeposit,
} from '@castcle-api/database';
import { Mailer } from '@castcle-api/utils/clients';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { WalletResponse } from '../dtos';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: WalletService;
  let userServiceV1: UserService;
  let authService: AuthenticationService;
  let mocksUsers: MockUserDetail[];
  let tAccountService: TAccountService;

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
      controllers: [],
      providers: [
        AnalyticService,
        AuthenticationService,
        ContentService,
        TAccountService,
        WalletService,
        Repository,
        UserService,
        UserServiceV2,
        WalletShortcutService,
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
    service = app.get<WalletService>(WalletService);
    userServiceV1 = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    tAccountService = app.get<TAccountService>(TAccountService);

    mocksUsers = await generateMockUsers(2, 0, {
      userService: userServiceV1,
      accountService: authService,
    });
    //init
    await mockDeposit(
      mocksUsers[0].user,
      5555,
      tAccountService._transactionModel,
    );
  });

  describe('getWalletBalance()', () => {
    it('should return personal balance', async () => {
      const balance = await service.getWalletBalance(mocksUsers[0].user);
      expect(balance).toEqual({
        id: mocksUsers[0].user.id,
        displayName: mocksUsers[0].user.displayName,
        castcleId: mocksUsers[0].user.displayId,
        farmBalance: 0,
        adsCredit: 0,
        availableBalance: 5555,
        totalBalance: 5555,
      } as WalletResponse);
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
});
