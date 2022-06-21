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
  NotificationService,
  QueueName,
  UserService,
  WalletShortcutService,
  generateMockUsers,
} from '@castcle-api/database';
import { Mailer } from '@castcle-api/utils/clients';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('WalletShortcutService', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: WalletShortcutService;
  let userServiceV1: UserService;
  let authService: AuthenticationService;
  let mocksUsers: MockUserDetail[];
  let shortcutId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CacheModule.register(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        HttpModule,
      ],
      providers: [
        AuthenticationService,
        WalletShortcutService,
        Repository,
        UserService,
        { provide: AnalyticService, useValue: {} },
        { provide: ContentService, useValue: {} },
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
      ],
    }).compile();

    service = moduleRef.get<WalletShortcutService>(WalletShortcutService);
    userServiceV1 = moduleRef.get<UserService>(UserService);
    authService = moduleRef.get<AuthenticationService>(AuthenticationService);

    mocksUsers = await generateMockUsers(3, 0, {
      userService: userServiceV1,
      accountService: authService,
    });
  });

  afterAll(async () => {
    await Promise.all([moduleRef?.close(), mongod.stop()]);
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
          order: index++ + 1,
        };
      });

      await service.sortWalletShortcut(sort, mocksUsers[1].account._id);

      const payloadShortcut = await service.getWalletShortcut(
        mocksUsers[1].account._id,
      );

      expect(payloadShortcut.shortcuts[0].order).toEqual(1);
      expect(payloadShortcut.shortcuts[1].order).toEqual(2);
    });
  });
});
