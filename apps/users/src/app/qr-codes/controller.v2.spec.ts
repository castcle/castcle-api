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
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QRCodeImageSize,
  QueueName,
  SocialSyncServiceV2,
  UserServiceV2,
} from '@castcle-api/database';
import { CastcleMongooseModule } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { Downloader } from '@castcle-api/utils/aws';
import { Mailer } from '@castcle-api/utils/clients';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { Repository } from 'libs/database/src/lib/repositories';
import { QRCodeControllerV2 } from './controller.v2';

describe('QRCodeControllerV2', () => {
  let app: TestingModule;
  let appController: QRCodeControllerV2;

  beforeAll(async () => {
    app = await TestingModule.createWithDb({
      imports: [
        CastcleMongooseModule,
        CacheModule.register(),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
      ],
      controllers: [QRCodeControllerV2],
      providers: [
        AnalyticService,
        ContentService,
        NotificationServiceV2,
        Repository,
        UserServiceV2,
        { provide: SocialSyncServiceV2, useValue: {} },
        { provide: Downloader, useValue: {} },
        { provide: HashtagService, useValue: {} },
        { provide: Mailer, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
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
    });

    appController = app.get(QRCodeControllerV2);
  });

  afterAll(() => {
    return app.close();
  });

  describe('createQRCode', () => {
    it('should return QRCodeResponseDto', async () => {
      const mock = await app.createUser();
      const createQRCode = await appController.createQRCode(
        {
          chainId: 'test',
          userId: mock.user._id,
          isMe: mock.user._id,
        },
        {
          size: QRCodeImageSize.Thumbnail,
        },
      );

      expect(createQRCode.payload).toMatch(/base64/g);
    });
  });
});
