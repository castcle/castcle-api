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

import { CastcleName } from '@castcle-api/utils/commons';
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
        ...options,
      };
    },
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('HashtagService', () => {
  let service: HashtagService;
  console.log('test in real db = ', env.DB_TEST_IN_DB);
  const importModules = env.DB_TEST_IN_DB
    ? [
        MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [HashtagService];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers,
    }).compile();
    service = module.get<HashtagService>(HashtagService);
  });

  afterAll(async () => {
    if (env.DB_TEST_IN_DB) await closeInMongodConnection();
  });

  describe('#create and get all hashtags', () => {
    it('should create new hashtag in db', async () => {
      const newHashtag: CreateHashtag = {
        tag: 'castcle',
        score: 90,
        aggregator: {
          _id: '6138afa4f616a467b5c4eb72',
        },
        name: 'Castcle',
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
        'stuff',
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
        'Airdrop',
      ]);
    });
  });

  describe('#extractHashtagFromContentPayload', () => {
    it('should return all #hashtag from ShortContent', () => {
      const short: ShortPayload = {
        message: 'helloworld #castcle',
      };
      expect(service.extractHashtagFromContentPayload(short)).toEqual([
        'castcle',
      ]);
    });
    it('should return all #hashtag from BlogContent', () => {
      const blog: BlogPayload = {
        message: 'helloworld #castcle',
        header: 'cool stuff',
      };
      expect(service.extractHashtagFromContentPayload(blog)).toEqual([
        'castcle',
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
          $ref: 'bean',
        },
        type: CommentType.Comment,
      };
      expect(service.extractHashtagFromCommentDto(commentDto)).toEqual([
        'bean',
      ]);
    });
  });

  describe('#createFromTag', () => {
    it('it should create a new tag with score 1', async () => {
      const currentTag = await service._hashtagModel
        .findOne({ tag: 'sompop' })
        .exec();
      expect(currentTag).toBeNull();
      await service.createFromTag('sompop');
      const newTag = await service._hashtagModel
        .findOne({ tag: 'sompop' })
        .exec();
      expect(newTag).toBeDefined();
      expect(newTag.tag).toEqual(new CastcleName('Sompop').slug);
      expect(newTag.score).toEqual(1);
    });
    it("should update the current hashtag if it's already exist", async () => {
      const currentTag = await service._hashtagModel
        .findOne({ tag: 'sompop' })
        .exec();
      expect(currentTag.score).toEqual(1);
      await service.createFromTag('soMPop');
      const newTag = await service._hashtagModel
        .findOne({ tag: 'sompop' })
        .exec();
      expect(newTag).toBeDefined();
      expect(newTag.tag).toEqual(new CastcleName('SomPop').slug);
      expect(newTag.score).toEqual(2);
    });
  });
  describe('#createFromTags', () => {
    it('should perform creatFromTag for multiple tags', async () => {
      await service.createFromTags(['CastClesSs', 'jUl', 'bEnz']);
      const newTag = await service._hashtagModel
        .findOne({ tag: 'castclesss' })
        .exec();
      expect(newTag).toBeDefined();
      expect(newTag.score).toEqual(1);
      const newTag2 = await service._hashtagModel
        .findOne({ tag: 'jul' })
        .exec();
      expect(newTag2).toBeDefined();
      expect(newTag2.score).toEqual(1);
      const newTag3 = await service._hashtagModel
        .findOne({ tag: 'benz' })
        .exec();
      expect(newTag3).toBeDefined();
      expect(newTag3.score).toEqual(1);
    });
  });
  describe('#decreaseTagScore', () => {
    it('should decrease score ', async () => {
      await service.removeFromTag('sompOp');
      const currentTag = await service._hashtagModel
        .findOne({ tag: 'sompop' })
        .exec();
      expect(currentTag.score).toEqual(1);
    });
  });
  describe('#removeFromTags', () => {
    it('should decrease all tags score', async () => {
      await service.removeFromTags(['CastClesSs', 'jUl', 'bEnz']);
      const newTag = await service._hashtagModel
        .findOne({ tag: 'castclesss' })
        .exec();
      expect(newTag).toBeDefined();
      expect(newTag.score).toEqual(0);
      const newTag2 = await service._hashtagModel
        .findOne({ tag: 'jul' })
        .exec();
      expect(newTag2).toBeDefined();
      expect(newTag2.score).toEqual(0);
      const newTag3 = await service._hashtagModel
        .findOne({ tag: 'benz' })
        .exec();
      expect(newTag3).toBeDefined();
      expect(newTag3.score).toEqual(0);
    });
    it('should not below 0', async () => {
      await service.removeFromTags(['CastClesSs', 'jUl', 'bEnz']);
      const newTag = await service._hashtagModel
        .findOne({ tag: 'castclesss' })
        .exec();
      expect(newTag).toBeDefined();
      expect(newTag.score).toEqual(0);
      const newTag2 = await service._hashtagModel
        .findOne({ tag: 'jul' })
        .exec();
      expect(newTag2).toBeDefined();
      expect(newTag2.score).toEqual(0);
      const newTag3 = await service._hashtagModel
        .findOne({ tag: 'benz' })
        .exec();
      expect(newTag3).toBeDefined();
      expect(newTag3.score).toEqual(0);
    });
  });
  describe('#updateFromTags', () => {
    it('should only update a new one and decrease the old one', async () => {
      await service.updateFromTags(['CastcleSSS', 'Jul'], ['sompop']);
      const currentTag = await service._hashtagModel
        .findOne({ tag: 'sompop' })
        .exec();
      expect(currentTag.score).toEqual(0);
      const newTag = await service._hashtagModel
        .findOne({ tag: 'castclesss' })
        .exec();
      expect(newTag).toBeDefined();
      expect(newTag.score).toEqual(1);
      const newTag2 = await service._hashtagModel
        .findOne({ tag: 'jul' })
        .exec();
      expect(newTag2).toBeDefined();
      expect(newTag2.score).toEqual(1);
    });
    it('should only update a new one and decrease the old one', async () => {
      await service.updateFromTags(['sompop'], ['CastcleSSS', 'Jul']);
      const currentTag = await service._hashtagModel
        .findOne({ tag: 'sompop' })
        .exec();
      expect(currentTag.score).toEqual(1);
      const newTag = await service._hashtagModel
        .findOne({ tag: 'castclesss' })
        .exec();
      expect(newTag).toBeDefined();
      expect(newTag.score).toEqual(0);
      const newTag2 = await service._hashtagModel
        .findOne({ tag: 'jul' })
        .exec();
      expect(newTag2).toBeDefined();
      expect(newTag2.score).toEqual(0);
    });
  });
});
