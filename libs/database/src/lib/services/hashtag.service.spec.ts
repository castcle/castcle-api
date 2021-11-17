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
import { BlogPayload, ShortPayload } from '../dtos';
import { CommentDto } from '../dtos/comment.dto';
import { ImagePayload } from '../dtos/content.dto';
import { CreateHashtag } from '../dtos/hashtag.dto';
import { env } from '../environment';
import { CommentType } from '../schemas/comment.schema';
import { HashtagService } from './hashtag.service';

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
        ...options
      };
    }
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('HashtagService', () => {
  let service: HashtagService;
  console.log('test in real db = ', env.db_test_in_db);
  const importModules = env.db_test_in_db
    ? [
        MongooseModule.forRoot(env.db_uri, env.db_options),
        MongooseAsyncFeatures,
        MongooseForFeatures
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [HashtagService];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers
    }).compile();
    service = module.get<HashtagService>(HashtagService);
  });

  afterAll(async () => {
    if (env.db_test_in_db) await closeInMongodConnection();
  });

  describe('#create and get all hashtags', () => {
    it('should create new hashtag in db', async () => {
      const newHashtag: CreateHashtag = {
        tag: 'castcle',
        score: 90,
        aggregator: {
          _id: '6138afa4f616a467b5c4eb72'
        },
        name: 'Castcle'
      };

      const resultData = await service.create(newHashtag);

      expect(resultData).toBeDefined();
      expect(resultData.tag).toEqual(newHashtag.tag);
      expect(resultData.name).toEqual(newHashtag.name);
      expect(resultData.aggregator.$id).toEqual(newHashtag.aggregator._id);
    });

    it('should get data in db', async () => {
      const result = await service.getAll();
      expect(result).toBeDefined();
      expect(result.length).toEqual(1);
    });
  });

  describe('#extractHashtagFromText', () => {
    it('should return all #hashtag from content', () => {
      expect(service.extractHashtagFromText('this is #good #stuff')).toEqual([
        'good',
        'stuff'
      ]);
    });
    it('should return all #hashtag with space infront only', () => {
      expect(
        service.extractHashtagFromText('this is #good blog#stuff')
      ).toEqual(['good']);
    });
    it('should pass complex case', () => {
      //metaverse  #GameFi #NFT #PlayToEarn #P2E #IDO  #BSC #PreSale  #Airdrop
      expect(
        service.extractHashtagFromText(
          'SupreSpace: 🎁There is 10BNB to reach the hard top🎁\n✅✅Private sale will be closed soon.\n✅✅Join Private sale here:\n\n✅Like and retweet\n✅Drop your BEP20 address \n#metaverse  #GameFi #NFT #PlayToEarn #P2E #IDO  #BSC #PreSale  #Airdrop\n\nhttps://twitter.com/SupreSpace/status/1460873380618399750'
        )
      ).toEqual([
        'metaverse',
        'GameFi',
        'NFT',
        'PlayToEarn',
        'P2E',
        'IDO',
        'BSC',
        'PreSale',
        'Airdrop'
      ]);
    });
  });

  describe('#extractHashtagFromContentPayload', () => {
    it('should return all #hashtag from ShortContent', () => {
      const short: ShortPayload = {
        message: 'helloworld #castcle'
      };
      expect(service.extractHashtagFromContentPayload(short)).toEqual([
        'castcle'
      ]);
    });
    it('should return all #hashtag from BlogContent', () => {
      const blog: BlogPayload = {
        message: 'helloworld #castcle',
        header: 'cool stuff'
      };
      expect(service.extractHashtagFromContentPayload(blog)).toEqual([
        'castcle'
      ]);
    });
    it('should return all #hashtag from ImageContent', () => {
      const image: ImagePayload = {};
      expect(service.extractHashtagFromContentPayload(image)).toEqual([]);
    });
  });

  describe('#extractHashtagFromCommentDto', () => {
    it('should return all #hashtag from CommentDto', () => {
      const commentDto: CommentDto = {
        message: 'cool #bean',
        author: 'test',
        targetRef: {
          $id: 'cool',
          $ref: 'bean'
        },
        type: CommentType.Comment
      };
      expect(service.extractHashtagFromCommentDto(commentDto)).toEqual([
        'bean'
      ]);
    });
  });
});
