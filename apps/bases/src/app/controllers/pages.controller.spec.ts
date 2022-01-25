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

import { Test, TestingModule } from '@nestjs/testing';
import {
  createCastcleMeta,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '@castcle-api/database';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import {
  UserService,
  AuthenticationService,
  ContentService,
} from '@castcle-api/database';
import { PagesController } from './pages.controller';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ContentDocument,
  CredentialDocument,
} from '@castcle-api/database/schemas';
import {
  Author,
  CastcleIncludes,
  ContentType,
  PageDto,
  SaveContentDto,
  ShortPayload,
} from '@castcle-api/database/dtos';
import { Image } from '@castcle-api/utils/aws';

import { TopicName, UserProducer } from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { CredentialRequest } from '@castcle-api/utils/interceptors';

const fakeProcessor = jest.fn();
const fakeBull = BullModule.registerQueue({
  name: TopicName.Users,
  redis: {
    host: '0.0.0.0',
    port: 6380,
  },
  processors: [fakeProcessor],
});
let mongod: MongoMemoryServer;
const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
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

describe('PageController', () => {
  let app: TestingModule;
  let pageController: PagesController;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userCredential: CredentialDocument;
  const pageDto: PageDto = {
    displayName: 'Super Page',
    castcleId: 'pageyo',
  };
  const pageDto2: PageDto = {
    displayName: 'Super Page2',
    castcleId: 'pageyo2',
  };
  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        fakeBull,
      ],
      controllers: [PagesController],
      providers: [
        UserService,
        AuthenticationService,
        ContentService,
        UserProducer,
        HashtagService,
      ],
    }).compile();
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    pageController = app.get<PagesController>(PagesController);
    const result = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th'],
    });
    const accountActivation = await authService.signupByEmail(
      result.accountDocument,
      {
        email: 'test@gmail.com',
        displayId: 'test1234',
        displayName: 'test',
        password: '1234AbcD',
      }
    );
    await authService.verifyAccount(accountActivation);
    jest.spyOn(pageController, '_uploadImage').mockImplementation(async () => {
      console.log('---mock uri--image');
      const mockImage = new Image({
        original: 'mockUri',
      });
      return mockImage;
    });
    userCredential = result.credentialDocument;
  });
  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('createPage', () => {
    it('should create new user that has the info from pageDTO', async () => {
      const newPageResponse = await pageController.createPage(
        { $credential: userCredential, $language: 'th' } as any,
        pageDto
      );
      expect(newPageResponse.images.avatar).toBeDefined();
      expect(newPageResponse.displayName).toEqual(pageDto.displayName);
      expect(newPageResponse.images.cover).toBeDefined();
      expect(newPageResponse.castcleId).toEqual(pageDto.castcleId);
      const testPage = await authService.getUserFromCastcleId(
        pageDto.castcleId
      );
      const pageResponse = testPage.toPageResponse();
      expect(pageResponse.images.avatar).toBeDefined();
      expect(pageResponse.displayName).toEqual(pageDto.displayName);
      expect(pageResponse.images.cover).toBeDefined();
      expect(pageResponse.castcleId).toEqual(pageDto.castcleId);
    });
  });
  describe('updatePage', () => {
    it('should update some properly in updatePageDto to the created page', async () => {
      const testPage = await authService.getUserFromCastcleId(
        pageDto.castcleId
      );
      const result = await pageController.updatePage(
        { $credential: userCredential, $language: 'th' } as any,
        testPage._id,
        {
          displayName: 'change baby',
          overview: 'yo',
          links: {
            website: 'https://castcle.com',
            facebook: 'https://facebook.com',
            twitter: 'https://twitter.com',
            youtube: 'https://youtube.com',
            medium: 'https://medium.com',
          },
        }
      );
      //expect(result).toEqual({ ...pageDto, displayName: 'change baby' });
      expect(result.displayName).toEqual('change baby');
      expect(result.links.website).toEqual('https://castcle.com');
      expect(result.links.facebook).toEqual('https://facebook.com');
      expect(result.links.twitter).toEqual('https://twitter.com');
      expect(result.links.youtube).toEqual('https://youtube.com');
      expect(result.links.medium).toEqual('https://medium.com');
      expect(result.overview).toEqual('yo');
    });
  });
  describe('deletePage', () => {
    it('should delete a page if user has permission', async () => {
      const testPage = await authService.getUserFromCastcleId(
        pageDto.castcleId
      );
      const result = await pageController.deletePage(
        { $credential: userCredential, $language: 'th' } as any,
        testPage._id,
        {
          password: '1234AbcD',
        }
      );
      expect(result).toEqual('');
      const postPage = await authService.getUserFromCastcleId(
        pageDto.castcleId
      );
      expect(postPage).toBeNull();
    });
  });
  describe('getPageFromId', () => {
    it('should be able to get page from user ID', async () => {
      await pageController.createPage(
        { $credential: userCredential, $language: 'th' } as any,
        pageDto2
      );
      const testPage = await authService.getUserFromCastcleId(
        pageDto2.castcleId
      );
      const getResult = await pageController.getPageFromId(
        { $credential: userCredential, $language: 'th' } as any,
        testPage._id
      );
      expect(getResult).toEqual(testPage.toPageResponse());
    });
    it('should be able to get page from CastcleId', async () => {
      const testPage = await authService.getUserFromCastcleId(
        pageDto2.castcleId
      );
      const getResult = await pageController.getPageFromId(
        { $credential: userCredential, $language: 'th' } as any,
        pageDto2.castcleId
      );
      expect(getResult).toEqual(testPage.toPageResponse());
    });
  });
  describe('getPageContents', () => {
    it('should return ContentsResponse that contain all contain that create by this page', async () => {
      const page = await authService.getUserFromCastcleId(pageDto2.castcleId);
      const contentDtos: SaveContentDto[] = [
        {
          type: ContentType.Short,
          payload: {
            message: 'hello',
          } as ShortPayload,
          castcleId: page.displayId,
        },
        {
          type: ContentType.Short,
          payload: {
            message: 'hi',
          } as ShortPayload,
          castcleId: page.displayId,
        },
      ];
      const createResult: ContentDocument[] = [];
      createResult[0] = await contentService.createContentFromUser(
        page,
        contentDtos[0]
      );
      createResult[1] = await contentService.createContentFromUser(
        page,
        contentDtos[1]
      );
      const response = await pageController.getPageContents(
        page._id,
        { $credential: userCredential, $language: 'th' } as any,
        { hasRelationshipExpansion: false }
      );
      const items = createResult
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
        .map((c) => c.toContentPayloadItem());

      const expectedObject = {
        payload: items,
        includes: new CastcleIncludes({
          users: createResult.map(({ author }) => new Author(author)),
          casts: [],
        }),
        meta: createCastcleMeta(createResult),
      };

      expect(JSON.stringify(response)).toEqual(JSON.stringify(expectedObject));
    });
  });
  describe('getAllPages', () => {
    it('should display all pages that has been created', async () => {
      const result = await pageController.getAllPages({
        $credential: userCredential,
      } as CredentialRequest);
      console.log(result);
      expect(result.payload.length).toEqual(1);
      expect(result.pagination.self).toEqual(1);
      expect(result.pagination.limit).toEqual(25);
    });
  });
});
