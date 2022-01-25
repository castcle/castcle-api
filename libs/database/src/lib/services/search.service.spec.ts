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
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { CreateHashtag } from '../dtos/hashtag.dto';
import { env } from '../environment';
import { UserType } from '../schemas/user.schema';
import { DEFAULT_TOP_TREND_QUERY_OPTIONS } from './../dtos/search.dto';
import { HashtagService } from './hashtag.service';
import { SearchService } from './search.service';

let mongod: MongoMemoryServer;
const rootMongooseTestModule = (
  options: MongooseModuleOptions = { useFindAndModify: false }
) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongod = await MongoMemoryServer.create();
      const mongoUri = mongod.getUri();
      return {
        uri: mongoUri,
        ...options,
      };
    },
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('SearchService', () => {
  let hashtagService: HashtagService;
  let service: SearchService;
  console.log('test in real db = ', env.DB_TEST_IN_DB);
  const importModules = env.DB_TEST_IN_DB
    ? [
        MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [HashtagService, SearchService];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers,
    }).compile();
    hashtagService = module.get<HashtagService>(HashtagService);
    service = module.get<SearchService>(SearchService);

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
        UserType.People,
        Math.floor(Math.random() * 99999)
      );
    }

    for (let i = 0; i < 15; i++) {
      await mockUser(
        `Page ${i}`,
        UserType.Page,
        Math.floor(Math.random() * 99999)
      );
    }

    for (let i = 0; i < 5; i++) {
      await mockUser(
        `cPage ${i}`,
        UserType.Page,
        Math.floor(Math.random() * 99999)
      );
    }

    for (let i = 0; i < 5; i++) {
      await mockUser(
        `cUser ${i}`,
        UserType.People,
        Math.floor(Math.random() * 99999)
      );
    }
  });

  afterAll(async () => {
    if (env.DB_TEST_IN_DB) await closeInMongodConnection();
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

  describe('#getSearch', () => {
    it('should get search result with keyword c', async () => {
      const result = await service.getSearch(null, 'c', 10);

      expect(result.keywords.length).toEqual(3);
      expect(result.hashtags.length).toEqual(2);
      expect(result.follows.length).toEqual(10);
    });

    it('should get search result with keyword c and limit follows 5', async () => {
      const result = await service.getSearch(null, 'c', 5);

      expect(result.keywords.length).toEqual(3);
      expect(result.hashtags.length).toEqual(2);
      expect(result.follows.length).toEqual(5);
    });

    it('should get empty result with keyword abc', async () => {
      const result = await service.getSearch(null, 'abc', 10);

      expect(result.keywords.length).toEqual(0);
      expect(result.hashtags.length).toEqual(0);
      expect(result.follows.length).toEqual(0);
    });
  });
});
