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
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '@castcle-api/database';
import { CastcleMongooseModule } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { Types } from 'mongoose';
import { EngagementService } from './engagement.service';

describe('Engagement Service', () => {
  let moduleRef: TestingModule;
  let service: EngagementService;

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CastcleMongooseModule,
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [EngagementService],
    });

    service = moduleRef.get(EngagementService);
  });

  afterAll(() => {
    return moduleRef.close();
  });

  describe('#track()', () => {
    it('should return UxEngagement when track is complete', async () => {
      const accountId = new Types.ObjectId();
      const now = new Date();
      const body = {
        platform: 'android',
        accountId: accountId.toString(),
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
      expect(uxTrackResult.account).toEqual(accountId);
      expect(uxTrackResult.client).toEqual(body.client);
      expect(uxTrackResult.eventData).toEqual(body.eventData);
      expect(uxTrackResult.eventType).toEqual(body.eventType);
      expect(uxTrackResult.feedItemId).toEqual(body.feedItemId);
      expect(uxTrackResult.screenInstance).toEqual(body.screenInstance);
      expect(uxTrackResult.target).toEqual(body.target);
      expect(uxTrackResult.targetId).toEqual(body.targetId);
    });
  });
});
