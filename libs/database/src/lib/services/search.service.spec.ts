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
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { CreateHashtag } from '../dtos/hashtag.dto';
import { DEFAULT_TOP_TREND_QUERY_OPTIONS } from '../dtos/search.dto';
import { UserType } from '../models';
import { HashtagService } from './hashtag.service';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let hashtagService: HashtagService;
  let service: SearchService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [HashtagService, SearchService],
    }).compile();

    hashtagService = moduleRef.get<HashtagService>(HashtagService);
    service = moduleRef.get<SearchService>(SearchService);

    const mockUser = async (name, type, follow) => {
      const user = new service._userModel({
        ownerAccount: '6138afa4f616a467b5c4eb72',
        displayId: name,
        displayName: name,
        type: type,
        followerCount: follow,
      });
      await user.save();
    };

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

    for (let i = 0; i < 30; i++) {
      await mockHashtag(`#castcle${i}`, `Castcle ${i}`, 90 - i);
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
    await moduleRef.close();
    await mongod.stop();
  });

  describe('#getTopTrends', () => {
    it('should get all top trend with default option', async () => {
      const result = await service.getTopTrends();

      expect(result.hashtags.length).toEqual(10);
      expect(result.follows.length).toEqual(10);
    });

    it('should get top trend exclude hashtags', async () => {
      const result = await service.getTopTrends({
        limit: DEFAULT_TOP_TREND_QUERY_OPTIONS.limit,
        exclude: 'hashtags',
      });

      expect(result.hashtags.length).toEqual(0);
      expect(result.follows.length).toEqual(10);
    });

    it('should get top trend exclude follows', async () => {
      const result = await service.getTopTrends({
        limit: DEFAULT_TOP_TREND_QUERY_OPTIONS.limit,
        exclude: 'follows',
      });
      expect(result.hashtags.length).toEqual(10);
      expect(result.follows.length).toEqual(0);
    });

    it('should get top trend with limit 20', async () => {
      const result = await service.getTopTrends({
        limit: 20,
      });
      expect(result.hashtags.length).toEqual(20);
      expect(result.follows.length).toEqual(20);
    });

    it('should get empty top trend with exclude all', async () => {
      const result = await service.getTopTrends({
        exclude: 'follows,hashtags',
      });
      expect(result.hashtags.length).toEqual(0);
      expect(result.follows.length).toEqual(0);
    });
  });
});
