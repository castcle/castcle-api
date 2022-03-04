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

import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AdsService } from './ads.service';
import {
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { generateMockUsers, MockUserDetail } from '../mocks/user.mocks';
import { AuthenticationService } from './authentication.service';
import { UserService } from './user.service';
import { AdsObjective } from '../models';
import { UserProducer } from '@castcle-api/utils/queue';
import { AdsQuery, ContentType, ShortPayload } from '../dtos';
import { Content } from '../schemas';
import { CacheModule } from '@nestjs/common';

describe('AdsService', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: AdsService;
  let authService: AuthenticationService;
  let userService: UserService;
  let contentService: ContentService;
  let mocks: MockUserDetail[];
  let promoteContent: Content;

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
        AdsService,
        AuthenticationService,
        UserService,
        ContentService,
        UserProducer,
        HashtagService,
      ],
    }).compile();
    service = app.get<AdsService>(AdsService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    userService = app.get<UserService>(UserService);
    contentService = app.get<ContentService>(ContentService);
    mocks = await generateMockUsers(2, 1, {
      accountService: authService,
      userService: userService,
    });
    promoteContent = await contentService.createContentFromUser(mocks[0].user, {
      castcleId: mocks[0].pages[0].id,
      payload: {
        message: 'this is prmote short',
      } as ShortPayload,
      type: ContentType.Short,
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });
  describe('#createAds', () => {
    it('should be able to create ads for promote Page', async () => {
      const adsIput = {
        campaignName: 'Ads1',
        campaignMessage: 'This is ads',
        userId: mocks[0].pages[0].id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
      };
      const ads = await service.createAds(mocks[0].account, adsIput);
      expect(ads.detail.dailyBudget).toEqual(adsIput.dailyBudget);
      expect(ads.detail.duration).toEqual(adsIput.duration);
      expect(ads.objective).toEqual(adsIput.objective);
      expect(ads.detail.message).toEqual(adsIput.campaignMessage);
      expect(ads.detail.name).toEqual(adsIput.campaignName);
      expect(ads.adsRef).not.toBeUndefined();
      expect(ads.adsRef.$id).toEqual(mocks[0].pages[0]._id);
    });
    it('should be able to create ads for promote contents', async () => {
      const adsIput = {
        campaignName: 'Ads2',
        campaignMessage: 'This is ads',
        contentId: promoteContent.id,
        dailyBudget: 1,
        duration: 5,
        objective: AdsObjective.Engagement,
      };
      const ads = await service.createAds(mocks[0].account, adsIput);
      expect(ads.detail.dailyBudget).toEqual(adsIput.dailyBudget);
      expect(ads.detail.duration).toEqual(adsIput.duration);
      expect(ads.objective).toEqual(adsIput.objective);
      expect(ads.detail.message).toEqual(adsIput.campaignMessage);
      expect(ads.detail.name).toEqual(adsIput.campaignName);
      expect(ads.adsRef).not.toBeUndefined();
      expect(ads.adsRef.$id).toEqual(promoteContent._id);
    });
  });
  describe('#listAds', () => {
    it('should be able to get list ads exist.', async () => {
      const adsCampaigns = await service.getListAds(mocks[0].account._id, {
        maxResults: 100,
        filter: 'week',
        timezone: '+07:00',
      } as AdsQuery);

      expect(adsCampaigns.length).toBeGreaterThan(0);
      expect(String(adsCampaigns[0].owner)).toBe(String(mocks[0].account._id));
    });
  });
  afterAll(() => {
    service._adsCampaignModel.deleteMany({});
    userService._accountModel.deleteMany({});
    userService._userModel.deleteMany({});
    contentService._contentModel.deleteMany({});
  });
});
