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
  AddressBookService,
  AnalyticService,
  AuthenticationService,
  CampaignService,
  ContentService,
  HashtagService,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  QueueName,
  TAccountService,
  UserService,
  UserServiceV2,
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

describe('AddressBookService', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: AddressBookService;
  let userServiceV1: UserService;
  let authService: AuthenticationService;
  let mocksUsers: MockUserDetail[];
  let taccountService: TAccountService;
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
      controllers: [],
      providers: [
        AnalyticService,
        AuthenticationService,
        ContentService,
        TAccountService,
        AddressBookService,
        Repository,
        UserService,
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
    service = app.get<AddressBookService>(AddressBookService);
    userServiceV1 = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    taccountService = app.get<TAccountService>(TAccountService);

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

  describe('createWalletShortcut', () => {
    it('should create wallet shortcut', async () => {
      const payloadShortcut = await service.createWalletShortcut(
        {
          chainId: 'castcle',
          userId: mocksUsers[0].user._id,
        },
        mocksUsers[1].account._id,
      );

      shortcutId = payloadShortcut.id;
      expect(payloadShortcut.userId).toEqual(mocksUsers[0].user._id);
      expect(payloadShortcut.castcleId).toEqual(mocksUsers[0].user.displayId);
    });
  });

  describe('getWalletShortcut', () => {
    it('should create wallet shortcut', async () => {
      const payloadShortcut = await service.getWalletShortcut(
        mocksUsers[1].account._id,
      );

      expect(payloadShortcut.accounts).toHaveLength(1);
      expect(payloadShortcut.shortcuts).toHaveLength(1);
    });
  });

  describe('deleteWalletShortcut', () => {
    it('should delete wallet shortcut', async () => {
      await service.deleteWalletShortcut(mocksUsers[1].account._id, shortcutId);

      const shortcut = await (service as any).repository.findWallerShortcut({
        _id: shortcutId,
      });

      expect(shortcut).toBeNull();
    });
  });

  describe('toWalletShortcutResponse', () => {
    it('should return payload wallet shortcut', async () => {
      const shortcut = await (service as any).repository.findWallerShortcut({
        accountId: mocksUsers[1].account._id,
      });

      const payloadShortcut = await service.toWalletShortcutResponse(
        mocksUsers[0].user,
        shortcut,
      );
      expect(payloadShortcut.userId).toEqual(mocksUsers[0].user._id);
      expect(payloadShortcut.castcleId).toEqual(mocksUsers[0].user.displayId);
    });
  });

  describe('sortWalletShortcut', () => {
    beforeAll(async () => {
      await service.createWalletShortcut(
        {
          chainId: 'castcle',
          userId: mocksUsers[0].user._id,
        },
        mocksUsers[1].account._id,
      );

      await service.createWalletShortcut(
        {
          chainId: 'castcle',
          userId: mocksUsers[2].user._id,
        },
        mocksUsers[1].account._id,
      );
    });
    it('should update order wallet shortcut', async () => {
      const shortcuts = await (service as any).repository.findWallerShortcuts({
        accountId: mocksUsers[1].account._id,
      });

      const sort = shortcuts.map((shortcut, index) => {
        return {
          id: shortcut._id,
          order: index++,
        };
      });

      await service.sortWalletShortcut(sort, mocksUsers[1].account._id);

      const newShortcuts = await (
        service as any
      ).repository.findWallerShortcuts({
        accountId: mocksUsers[1].account._id,
      });

      newShortcuts.map((shortcut, index) => {
        expect(shortcut.order).toEqual(index++);
      });
    });
  });

  afterAll(async () => {
    await (service as any).repository.walletShortcutModel.deleteMany({});
    await (service as any).repository.userModel.deleteMany({});
    await (service as any).repository.accountModel.deleteMany({});
    await app.close();
    await mongod.stop();
  });
});
