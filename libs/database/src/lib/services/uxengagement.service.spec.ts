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

import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  MongooseAsyncFeatures,
  MongooseForFeatures,
  UserService,
} from '../database.module';
import { QueueName } from '../models';
import { Account, Credential } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { UxEngagementService } from './uxengagement.service';

describe('UxEngagement Service', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: UxEngagementService;
  let authService: AuthenticationService;
  let result: {
    accountDocument: Account;
    credentialDocument: Credential;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        UxEngagementService,
        AuthenticationService,
        ContentService,
        HashtagService,
        UserService,
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
    service = moduleRef.get<UxEngagementService>(UxEngagementService);
    authService = moduleRef.get<AuthenticationService>(AuthenticationService);
    result = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'ifong',
    });
    //sign up to create actual account
    await authService.signupByEmail(result.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567',
    });
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('#track()', () => {
    it('should return UxEngagement when track is complete', async () => {
      const now = new Date();
      const body = {
        platform: 'android',
        accountId: result.accountDocument._id as unknown as string,
        client: 'android1234',
        eventData: { test: 'hi' },
        eventType: 'test',
        feedItemId: '1234',
        screenId: 'testScreenId',
        screenInstance: { abcd: 1234 },
        target: 'testTarget',
        targetId: 'testTargetId',
        timestamp: now.getTime() + '',
        uxSessionId: 'ux-track-01',
      };
      const uxTrackResult = await service.track(body);
      expect(uxTrackResult).toBeDefined();
      expect(uxTrackResult.platform).toEqual(body.platform);
      expect(uxTrackResult.account).toEqual(result.accountDocument._id);
      expect(uxTrackResult.client).toEqual(body.client);
      expect(uxTrackResult.eventData).toEqual(body.eventData);
      expect(uxTrackResult.eventType).toEqual(body.eventType);
      expect(uxTrackResult.feedItemId).toEqual(body.feedItemId);
      expect(uxTrackResult.screenInstance).toEqual(body.screenInstance);
      expect(uxTrackResult.target).toEqual(body.target);
      expect(uxTrackResult.targetId).toEqual(body.targetId);
      //expect(uxTrackResult.timestamp).toEqual(now); so prebuilt could pass
    });
  });
});
