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
import {
  MongooseAsyncFeatures,
  MongooseForFeatures,
  SocialSyncService,
} from '../database.module';
import { SocialSyncDeleteDto, SocialSyncDto } from '../dtos/user.dto';
import { env } from '../environment';
import { SocialProvider } from '../models';
import { UserDocument, UserType } from './../schemas/user.schema';

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

describe('SocialSyncService', () => {
  let service: SocialSyncService;
  let mocksUser: UserDocument;
  console.log('test in real db = ', env.DB_TEST_IN_DB);
  const importModules = env.DB_TEST_IN_DB
    ? [
        MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [SocialSyncService];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers,
    }).compile();
    service = module.get<SocialSyncService>(SocialSyncService);

    mocksUser = new service.userModel({
      ownerAccount: '61b4a3b3bb19fc8ed04edb8e',
      displayName: 'mock user',
      displayId: 'mockid',
      type: UserType.People,
    });
    await mocksUser.save();
  });

  afterAll(async () => {
    if (env.DB_TEST_IN_DB) await closeInMongodConnection();
  });

  describe('#create social sync', () => {
    it('should create new social sync in db', async () => {
      const socialSyncDto: SocialSyncDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Facebook,
        socialId: '12345678',
        userName: 'mockfb',
        displayName: 'mock fb',
        avatar: 'www.facebook.com/mockfb',
        active: true,
      };
      const resultData = await service.create(mocksUser, socialSyncDto);

      expect(resultData).toBeDefined();
      expect(resultData.provider).toEqual(SocialProvider.Facebook);
      expect(resultData.author.id).toEqual(mocksUser.id);
      expect(resultData.socialId).toEqual('12345678');
    });
  });

  describe('#getAllSocialSyncBySocial', () => {
    it('should get all SocialSync BySocial in db', async () => {
      const socialSyncDto: SocialSyncDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Twitter,
        socialId: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true,
      };
      await service.create(mocksUser, socialSyncDto);

      const resultData = await service.getAllSocialSyncBySocial(
        SocialProvider.Facebook,
        '12345678'
      );

      expect(resultData).toBeDefined();
      expect(resultData[0].provider).toEqual(SocialProvider.Facebook);
      expect(resultData[0].socialId).toEqual('12345678');
      expect(resultData.length).toEqual(1);
    });
  });

  describe('#getSocialSyncByUser', () => {
    it('should get all SocialSync By User in db', async () => {
      const resultData = await service.getSocialSyncByUser(mocksUser);
      expect(resultData).toBeDefined();
      expect(resultData.length).toEqual(2);
    });
  });

  describe('#update', () => {
    it('should update social sync in db', async () => {
      const updateSocialSyncDto: SocialSyncDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Facebook,
        socialId: '7891234',
        userName: 'mockfb',
        displayName: 'mock fb',
        avatar: 'www.facebook.com/mockfb',
        active: false,
      };
      await service.update(updateSocialSyncDto, mocksUser);
      const socialSyncDoc = await service.getSocialSyncByUser(mocksUser);
      const result = socialSyncDoc.find(
        (x) => x.provider === updateSocialSyncDto.provider
      );
      expect(result).toBeDefined();
      expect(result.provider).toEqual(SocialProvider.Facebook);
      expect(result.socialId).toEqual('7891234');
      expect(result.active).toEqual(false);
    });
  });

  describe('#delete', () => {
    it('should delete social sync in db', async () => {
      const deleteSocial: SocialSyncDeleteDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Facebook,
        socialId: '7891234',
      };
      await service.delete(deleteSocial, mocksUser);
      const socialSyncDoc = await service.getSocialSyncByUser(mocksUser);
      const result = socialSyncDoc.find(
        (x) => x.provider === deleteSocial.provider
      );
      expect(result).toBeUndefined();
      expect(socialSyncDoc).toBeDefined();
      expect(socialSyncDoc.length).toEqual(1);
    });
  });
});
