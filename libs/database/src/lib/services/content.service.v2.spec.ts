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
import { NotificationServiceV2 } from './notification.service.v2';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ContentServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
} from '../database.module';
import { ContentType, NotificationType } from '../dtos';
import { generateMockUsers, MockUserDetail } from '../mocks/user.mocks';
import { QueueName } from '../models';
import { Content } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UserService } from './user.service';

describe('ContentServiceV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: ContentServiceV2;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userService: UserService;
  let content: Content;
  let mocksUsers: MockUserDetail[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        AuthenticationService,
        ContentServiceV2,
        ContentService,
        HashtagService,
        UserService,
        NotificationService,
        NotificationServiceV2,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    authService = app.get(AuthenticationService);
    contentService = app.get(ContentService);
    service = app.get(ContentServiceV2);
    userService = app.get(UserService);

    mocksUsers = await generateMockUsers(3, 0, {
      userService: userService,
      accountService: authService,
    });

    const user = mocksUsers[0].user;
    content = await contentService.createContentFromUser(user, {
      payload: { message: 'content v2' },
      type: ContentType.Short,
      castcleId: user.displayId,
    });
  });

  describe('#likeCast()', () => {
    it('should create like cast.', async () => {
      await service.likeCast(
        content,
        mocksUsers[1].user,
        mocksUsers[1].account
      );
      const engagement = await (service as any)._engagementModel.findOne({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id,
        },
      });
      expect(engagement).toBeTruthy();
      expect(String(engagement.user)).toEqual(String(mocksUsers[1].user._id));
      expect(String(engagement.targetRef.oid)).toEqual(String(content._id));
      expect(engagement.type).toEqual(NotificationType.Like);
    });
  });
  describe('#unlikeCast()', () => {
    it('should delete unlike cast.', async () => {
      await service.unlikeCast(content._id, mocksUsers[1].user);
      const engagement = await (service as any)._engagementModel.findOne({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id,
        },
      });
      expect(engagement).toBeNull();
    });
  });
  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
});
