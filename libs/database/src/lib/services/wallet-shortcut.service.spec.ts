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

import { CastcleMongooseModule, Environment } from '@castcle-api/environments';
import { CreatedUser, TestingModule } from '@castcle-api/testing';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { Repository } from 'libs/database/src/lib/repositories';
import {
  ContentService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  TAccountService,
  WalletShortcutService,
} from '../database.module';
import { QueueName } from '../models';

describe('WalletShortcutService', () => {
  let moduleRef: TestingModule;
  let service: WalletShortcutService;
  let mocksUsers: CreatedUser[];
  let shortcutId: string;

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CastcleMongooseModule,
        CacheModule.register(),
        MongooseForFeatures(),
        MongooseAsyncFeatures(),
        HttpModule,
      ],
      providers: [
        WalletShortcutService,
        Repository,
        TAccountService,
        { provide: ContentService, useValue: {} },
        {
          provide: getQueueToken(QueueName.NEW_TRANSACTION),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    });

    service = moduleRef.get(WalletShortcutService);
    mocksUsers = await moduleRef.createUsers(2);
    Environment.CHAIN_INTERNAL = 'castcle';
  });

  afterAll(() => {
    return moduleRef.close();
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

  describe('sortWalletShortcut', () => {
    it('should update order wallet shortcut', async () => {
      const sortShortcut = [
        {
          id: shortcutId,
          order: 1,
        },
      ];
      await service.sortWalletShortcut(sortShortcut, mocksUsers[1].account._id);

      const payloadShortcut = await service.getWalletShortcut(
        mocksUsers[1].account._id,
      );

      expect(payloadShortcut.shortcuts[0].order).toEqual(1);
    });
  });

  describe('deleteWalletShortcut', () => {
    it('should delete wallet shortcut', async () => {
      const shortcut = await service.deleteWalletShortcut(
        mocksUsers[1].account._id,
        shortcutId,
      );

      expect(shortcut).toBeUndefined();
    });
  });
});
