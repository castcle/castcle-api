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
  ContentService,
  MongooseAsyncFeatures,
  MongooseForFeatures
} from '@castcle-api/database';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { UserService, AuthenticationService } from '@castcle-api/database';
import { ContentController } from './app.controller';
import { AppService } from './app.service';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CaslAbilityFactory } from '@castcle-api/casl';
import {
  AccountDocument,
  CredentialDocument,
  UserDocument
} from '@castcle-api/database/schemas';
import { BlogPayload, PageDto } from '@castcle-api/database/dtos';
import { ContentType, ShortPayload } from '@castcle-api/database/dtos';
import { UserType } from '@castcle-api/database/schemas';
import { TopicName, UserProducer } from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { ContentProducer } from '@castcle-api/utils/queue';

const fakeProcessor = jest.fn();
const fakeBull = BullModule.registerQueue({
  name: TopicName.Users,
  redis: {
    host: '0.0.0.0',
    port: 6380
  },
  processors: [fakeProcessor]
});
const fakeBull2 = BullModule.registerQueue({
  name: TopicName.Contents,
  redis: {
    host: '0.0.0.0',
    port: 6380
  },
  processors: [fakeProcessor]
});
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

describe('ContentController', () => {
  let app: TestingModule;
  let contentController: ContentController;
  let service: UserService;
  let appService: AppService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userAccount: AccountDocument;
  let userCredential: CredentialDocument;
  let user: UserDocument;
  const pageDto: PageDto = {
    displayName: 'Super Page',
    castcleId: 'pageyo'
  };
  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        CacheModule.register({
          store: 'memory',
          ttl: 1000
        }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        fakeBull,
        fakeBull2
      ],
      controllers: [ContentController],
      providers: [
        AppService,
        UserService,
        AuthenticationService,
        ContentService,
        CaslAbilityFactory,
        UserProducer,
        ContentProducer
      ]
    }).compile();
    service = app.get<UserService>(UserService);
    appService = app.get<AppService>(AppService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    contentController = app.get<ContentController>(ContentController);
    jest
      .spyOn(appService, 'uploadContentToS3')
      .mockImplementation(async (body) => body);
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
    userCredential = await authService.getCredentialFromAccessToken(
      result.credentialDocument.accessToken
    ); //result.credentialDocument;
    user = await service.getUserFromCredential(userCredential);
    console.debug('======USER FROM TEST=====');
    console.debug(user);
  });
  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('createFeedContent', () => {
    it('should create a new short content from DTO', async () => {
      const shortPayload = {
        message: 'อุบกขา',
        link: [
          {
            type: 'other',
            url: 'https://www.facebook.com/watch/?v=345357500470873'
          }
        ]
      } as ShortPayload;
      const result = await contentController.createFeedContent(
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId
        },
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      expect(result.payload.id).toBeDefined();
      expect(result.payload.type).toEqual(ContentType.Short);
      expect(result.payload.payload).toEqual(shortPayload);
      const content = await contentService.getContentFromId(result.payload.id);
      expect(result.payload).toEqual(content.toContentPayload());
      expect(result.payload.author.id).toEqual(user._id);
    });
    it('should create a new blog content from DTO', async () => {
      const blogPayload = {
        header: 'How to be a centinare',
        message: 'Sell quick',
        photo: {
          cover: {
            original: 'http://placehold.it/500x500'
          },
          contents: [
            { original: 'http://placehold.it/200x200' },
            { original: 'http://placehold.it/300x300' }
          ]
        }
      } as BlogPayload;
      const result = await contentController.createFeedContent(
        {
          payload: blogPayload,
          type: ContentType.Blog,
          castcleId: user.displayId
        },
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      expect(result.payload.id).toBeDefined();
      expect(result.payload.type).toEqual(ContentType.Blog);
      expect(result.payload.payload).toEqual(blogPayload);
      const content = await contentService.getContentFromId(result.payload.id);
      //expect(result.payload.).toEqual(content.toContentPayload());
      expect(result.payload.author.id).toEqual(user._id);
    });
    it('should be able to create a content by page', async () => {
      const pageDto = {
        avatar: {
          original: 'http://placehold.it/200x200'
        },
        cover: {
          original: 'http://placehold.it/1200x500'
        },
        displayName: 'Whatsupidoo',
        castcleId: 'whatsup'
      };
      const newPage = await service.createPageFromCredential(
        userCredential,
        pageDto
      );
      const shortPayload = {
        message: 'อุบกขา',
        link: [
          {
            type: 'other',
            url: 'https://www.facebook.com/watch/?v=345357500470873'
          }
        ]
      } as ShortPayload;
      const result = await contentController.createFeedContent(
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: newPage.displayId
        },
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      expect(result.payload.author.id).toEqual(newPage._id);
    });
  });
  describe('getContentFromId', () => {
    it('should be able to get a content that has been created', async () => {
      const shortPayload = {
        message: 'อุบกขา',
        link: [
          {
            type: 'other',
            url: 'https://www.facebook.com/watch/?v=345357500470873'
          }
        ]
      } as ShortPayload;
      const result = await contentController.createFeedContent(
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId
        },
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      const getResult = await contentController.getContentFromId(
        result.payload.id,
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      expect(getResult).toEqual(result);
    });
  });

  describe('updateContentFromId', () => {
    it('should be able to update a posted content', async () => {
      const shortPayload = {
        message: 'อุบกขา',
        link: [
          {
            type: 'other',
            url: 'https://www.facebook.com/watch/?v=345357500470873'
          }
        ]
      } as ShortPayload;
      const result = await contentController.createFeedContent(
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId
        },
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      const updateContentPayload = {
        message: 'Hello World'
      } as ShortPayload;
      const updateResult = await contentController.updateContentFromId(
        result.payload.id,
        {
          payload: updateContentPayload,
          type: ContentType.Short,
          castcleId: user.displayId
        },
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      expect(updateResult.payload.payload).toEqual(updateContentPayload);
      const getResult = await contentController.getContentFromId(
        result.payload.id,
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      expect(getResult.payload).toEqual(updateResult.payload);
    });
  });
});
