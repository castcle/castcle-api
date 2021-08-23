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
  MongooseAsyncFeatures,
  MongooseForFeatures
} from '@castcle-api/database';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import {
  UserService,
  AuthenticationService,
  ContentService
} from '@castcle-api/database';
import { PageController } from '../pages/pages.controller';
import { AppService } from '../../app.service';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AccountDocument,
  ContentDocument,
  CredentialDocument,
  UserType
} from '@castcle-api/database/schemas';
import {
  ContentType,
  PageDto,
  SaveContentDto,
  ShortPayload
} from '@castcle-api/database/dtos';
import { Image } from '@castcle-api/utils/aws';

let mongod: MongoMemoryServer;
const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
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

describe('PageController', () => {
  let app: TestingModule;
  let pageController: PageController;
  let service: UserService;
  let appService: AppService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userAccount: AccountDocument;
  let userCredential: CredentialDocument;
  const pageDto: PageDto = {
    avatar: 'http://placehold.it/100x100',
    cover: 'http://placehold.it/1500x300',
    displayName: 'Super Page',
    username: 'pageyo'
  };
  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures
      ],
      controllers: [PageController],
      providers: [
        AppService,
        UserService,
        AuthenticationService,
        ContentService
      ]
    }).compile();
    service = app.get<UserService>(UserService);
    appService = app.get<AppService>(AppService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    pageController = app.get<PageController>(PageController);
    const result = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th']
    });
    const accountActivation = await authService.signupByEmail(
      result.accountDocument,
      {
        email: 'test@gmail.com',
        displayId: 'test1234',
        displayName: 'test',
        password: '1234AbcD'
      }
    );
    userAccount = await authService.verifyAccount(accountActivation);
    jest.spyOn(pageController, '_uploadImage').mockImplementation(async () => {
      console.log('---mock uri--image');
      const mockImage = new Image('mockuri');
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
      expect(newPageResponse.avatar).toEqual(pageDto.avatar);
      expect(newPageResponse.displayName).toEqual(pageDto.displayName);
      expect(newPageResponse.cover).toEqual(pageDto.cover);
      expect(newPageResponse.username).toEqual(pageDto.username);
      const testPage = await authService.getUserFromCastcleId(pageDto.username);
      const pageResponse = testPage.toPageResponse();
      expect(pageResponse.avatar).toEqual(pageDto.avatar);
      expect(pageResponse.displayName).toEqual(pageDto.displayName);
      expect(pageResponse.cover).toEqual(pageDto.cover);
      expect(pageResponse.username).toEqual(pageDto.username);
    });
  });
  describe('updatePage', () => {
    it('should update some properly in updatePageDto to the created page', async () => {
      const testPage = await authService.getUserFromCastcleId(pageDto.username);
      const result = await pageController.updatePage(
        { $credential: userCredential, $language: 'th' } as any,
        testPage._id,
        { displayName: 'change baby' }
      );
      //expect(result).toEqual({ ...pageDto, displayName: 'change baby' });
      expect(result.displayName).toEqual('change baby');
    });
  });
  describe('deletePage', () => {
    it('should delete a page if user has permission', async () => {
      const testPage = await authService.getUserFromCastcleId(pageDto.username);
      const result = await pageController.deletePage(
        { $credential: userCredential, $language: 'th' } as any,
        testPage._id
      );
      expect(result).toEqual('');
      const postPage = await authService.getUserFromCastcleId(pageDto.username);
      expect(postPage).toBeNull();
    });
  });
  describe('getPageFromId', () => {
    it('should be able to get page from user ID', async () => {
      const newPageResponse = await pageController.createPage(
        { $credential: userCredential, $language: 'th' } as any,
        pageDto
      );
      const testPage = await authService.getUserFromCastcleId(pageDto.username);
      const getResult = await pageController.getPageFromId(
        { $credential: userCredential, $language: 'th' } as any,
        testPage._id
      );
      expect(getResult).toEqual(testPage.toPageResponse());
    });
    it('should be able to get page from CastcleId', async () => {
      const testPage = await authService.getUserFromCastcleId(pageDto.username);
      const getResult = await pageController.getPageFromId(
        { $credential: userCredential, $language: 'th' } as any,
        pageDto.username
      );
      expect(getResult).toEqual(testPage.toPageResponse());
    });
  });
  describe('getPageContents', () => {
    it('should return ContentsReponse that contain all contain that create by this page', async () => {
      const page = await authService.getUserFromCastcleId(pageDto.username);
      const contentDtos: SaveContentDto[] = [
        {
          type: ContentType.Short,
          payload: {
            message: 'hello'
          } as ShortPayload,
          author: {
            id: page._id,
            type: UserType.Page
          }
        },
        {
          type: ContentType.Short,
          payload: {
            message: 'hi'
          } as ShortPayload,
          author: {
            id: page._id,
            type: UserType.Page
          }
        }
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
      const response = await pageController.getPageContents(page._id, {
        $credential: userCredential,
        $language: 'th'
      } as any);

      expect(response).toEqual({
        payload: createResult
          .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
          .map((c) => c.toPagePayload()),
        pagination: {
          self: 1,
          limit: 25
        }
      });
    });
  });
  describe('getAllPages', () => {
    it('should display all pages that has been created', async () => {
      const result = await pageController.getAllPages();
      console.log(result);
      expect(result.payload.length).toEqual(1);
      expect(result.pagination.self).toEqual(1);
      expect(result.pagination.limit).toEqual(25);
    });
  });
});
