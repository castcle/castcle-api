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
import {
  MongooseAsyncFeatures,
  MongooseForFeatures,
  SocialSyncService,
} from '../database.module';
import { SocialSyncDeleteDto, SocialSyncDto } from '../dtos/user.dto';
import { SocialProvider, UserType } from '../models';
import { SocialSync, User } from '../schemas';

describe('SocialSyncService', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: SocialSyncService;
  let mocksUser: User;
  let mocksPage: User;
  let mockSocialSync: SocialSync;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [SocialSyncService],
    }).compile();

    service = moduleRef.get<SocialSyncService>(SocialSyncService);

    mocksUser = new (service as any).userModel({
      ownerAccount: '61b4a3b3bb19fc8ed04edb8e',
      displayName: 'mock user',
      displayId: 'mockid',
      type: UserType.PEOPLE,
    });
    await mocksUser.save();

    mocksPage = await new (service as any).userModel({
      ownerAccount: '61b4a3b3bb19fc8ed04edb8e',
      displayName: 'mock user',
      displayId: 'mockid',
      type: UserType.PAGE,
    }).save();
    const socialSyncDto: SocialSyncDto = {
      castcleId: 'mockcast',
      provider: SocialProvider.Twitter,
      socialId: 't12345678',
      userName: 'mocktw',
      displayName: 'mock tw',
      avatar: 'www.twitter.com/mocktw',
      active: true,
    };
    mockSocialSync = await service.create(mocksPage, socialSyncDto);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
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
      expect(resultData.user).toEqual(mocksUser._id);
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
        '12345678',
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
        autoPost: false,
      };
      await service.update(updateSocialSyncDto, mocksUser);
      const socialSyncDoc = await service.getSocialSyncByUser(mocksUser);
      const result = socialSyncDoc.find(
        (x) => x.provider === updateSocialSyncDto.provider,
      );
      expect(result).toBeDefined();
      expect(result.provider).toEqual(SocialProvider.Facebook);
      expect(result.socialId).toEqual('7891234');
      expect(result.active).toEqual(false);
      expect(result.autoPost).toEqual(false);
    });
  });

  describe('#delete', () => {
    it('should delete social sync in db', async () => {
      const deleteSocial: SocialSyncDeleteDto = {
        castcleId: 'mockcast',
        provider: SocialProvider.Facebook,
        socialId: '7891234',
      };
      await service.delete(deleteSocial, mocksUser, true);
      const socialSyncDoc = await service.getSocialSyncByUser(mocksUser);
      const result = socialSyncDoc.find(
        (x) => x.provider === deleteSocial.provider,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('#getPageByUserAndPageId', () => {
    it('should get page is exist.', async () => {
      const page = await service.getPageByPageIdAndAccountId(
        mockSocialSync,
        mocksUser,
      );
      expect(mocksPage._id).toEqual(page._id);
      expect(mocksPage.displayName).toEqual(page.displayName);
      expect(mocksPage.displayId).toEqual(page.displayId);
    });
  });
  describe('#getSocialSyncBySocialId', () => {
    it('should get sync social is exist.', async () => {
      const social = await service.getSocialSyncBySocialId(mockSocialSync._id);

      expect(mockSocialSync.provider).toEqual(social.provider);
      expect(mockSocialSync.socialId).toEqual(social.socialId);
      expect(mockSocialSync.userName).toEqual(social.userName);
      expect(mockSocialSync.displayName).toEqual(social.displayName);
    });
  });
  describe('#updateAutoPostBySocialId', () => {
    it('should update auto post is exist.', async () => {
      await service.updateAutoPostBySocialId(mockSocialSync, true);
      const social = await service.getSocialSyncBySocialId(mockSocialSync._id);
      expect(social.autoPost).toEqual(true);
    });
    it('should delete auto post is exist.', async () => {
      await service.updateAutoPostBySocialId(mockSocialSync, false);
      const social = await service.getSocialSyncBySocialId(mockSocialSync._id);
      expect(social.autoPost).toEqual(false);
    });
  });
});
