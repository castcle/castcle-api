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
  AuthenticationService,
  CreateHashtag,
  Credential,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  SearchService,
  UserService,
  UserType,
} from '@castcle-api/database';
import { CacheModule } from '@nestjs/common/cache';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SearchesController } from './searches.controller';

describe('NotificationsController', () => {
  let mongod: MongoMemoryServer;
  let controller: SearchesController;
  let app: TestingModule;
  let hashtagService: HashtagService;
  let search: SearchService;
  let userCredential: Credential;
  let authService: AuthenticationService;
  const mockHashtag = async (slug, hName, hScore) => {
    const newHashtag: CreateHashtag = {
      tag: slug,
      score: hScore,
      aggregator: {
        _id: '6138afa4f616a467b5c4eb72',
      },
      name: hName,
    };
    await hashtagService.create(newHashtag);
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
      ],
      controllers: [SearchesController],
      providers: [
        HashtagService,
        SearchService,
        AuthenticationService,
        {
          provide: UserService,
          useValue: { getUserFromCredential: jest.fn() },
        },
      ],
    }).compile();
    controller = app.get<SearchesController>(SearchesController);
    search = app.get<SearchService>(SearchService);
    hashtagService = app.get<HashtagService>(HashtagService);
    authService = app.get<AuthenticationService>(AuthenticationService);

    const resultAccount = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th'],
    });

    userCredential = resultAccount.credentialDocument;

    const mockUser = async (name, type, follow) => {
      const user = new search._userModel({
        ownerAccount: '6138afa4f616a467b5c4eb72',
        displayName: name,
        displayId: name,
        type: type,
        followerCount: follow,
      });
      await user.save();
    };

    for (let i = 0; i < 30; i++) {
      await mockHashtag(`castcle${i}`, `Castcle ${i}`, 90 - i);
    }

    for (let i = 0; i < 15; i++) {
      await mockUser(
        `User ${i}`,
        UserType.PEOPLE,
        Math.floor(Math.random() * 99999),
      );
    }

    for (let i = 0; i < 15; i++) {
      await mockUser(
        `Page ${i}`,
        UserType.PAGE,
        Math.floor(Math.random() * 99999),
      );
    }

    for (let i = 0; i < 5; i++) {
      await mockUser(
        `cPage ${i}`,
        UserType.PAGE,
        Math.floor(Math.random() * 99999),
      );
    }

    for (let i = 0; i < 5; i++) {
      await mockUser(
        `cUser ${i}`,
        UserType.PEOPLE,
        Math.floor(Math.random() * 99999),
      );
    }
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('getTopTrends', () => {
    it('should return TopTrendsResponse that contain all data', async () => {
      const responseResult = await controller.getTopTrends({
        $credential: userCredential,
      } as any);

      expect(responseResult.hashtags.length).toEqual(10);
      expect(responseResult.hashtags[0].rank).toBeDefined();
      expect(responseResult.hashtags[0].id).toBeDefined();
      expect(responseResult.hashtags[0].slug).toBeDefined();
      expect(responseResult.hashtags[0].name).toBeDefined();
      expect(responseResult.hashtags[0].key).toBeDefined();
      expect(responseResult.hashtags[0].count).toBeDefined();
      expect(responseResult.hashtags[0].trends).toBeDefined();

      expect(responseResult.follows.length).toEqual(10);
      expect(responseResult.follows[0].id).toBeDefined();
      expect(responseResult.follows[0].castcleId).toBeDefined();
      expect(responseResult.follows[0].displayName).toBeDefined();
      expect(responseResult.follows[0].overview).toBeDefined();
      expect(responseResult.follows[0].type).toBeDefined();
      expect(responseResult.follows[0].avatar).toBeDefined();
      expect(responseResult.follows[0].aggregator.type).toBeDefined();
      expect(responseResult.follows[0].aggregator.id).toBeDefined();
      expect(responseResult.follows[0].aggregator.action).toBeDefined();
      expect(responseResult.follows[0].aggregator.message).toBeDefined();
      expect(responseResult.follows[0].verified).toBeDefined();
      expect(responseResult.follows[0].count).toBeDefined();
    });

    it('should return TopTrendsResponse that contain with exclude hashtags', async () => {
      const responseResult = await controller.getTopTrends(
        {
          $credential: userCredential,
        } as any,
        20,
        'hashtags',
      );

      expect(responseResult.hashtags.length).toEqual(0);
      expect(responseResult.follows.length).toEqual(20);
      expect(responseResult.follows[0].id).toBeDefined();
      expect(responseResult.follows[0].castcleId).toBeDefined();
      expect(responseResult.follows[0].displayName).toBeDefined();
      expect(responseResult.follows[0].overview).toBeDefined();
      expect(responseResult.follows[0].type).toBeDefined();
      expect(responseResult.follows[0].avatar).toBeDefined();
      expect(responseResult.follows[0].aggregator.type).toBeDefined();
      expect(responseResult.follows[0].aggregator.id).toBeDefined();
      expect(responseResult.follows[0].aggregator.action).toBeDefined();
      expect(responseResult.follows[0].aggregator.message).toBeDefined();
      expect(responseResult.follows[0].verified).toBeDefined();
      expect(responseResult.follows[0].count).toBeDefined();
    });

    it('should return Empty TopTrendsResponse that contain with exclude hashtags and follows', async () => {
      const responseResult = await controller.getTopTrends(
        {
          $credential: userCredential,
        } as any,
        20,
        'hashtags,follows',
      );

      expect(responseResult.hashtags.length).toEqual(0);
      expect(responseResult.follows.length).toEqual(0);
    });
  });
});
