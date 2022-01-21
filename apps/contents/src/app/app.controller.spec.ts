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
import { CaslAbilityFactory } from '@castcle-api/casl';
import {
  AuthenticationService,
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  UserService,
} from '@castcle-api/database';
import {
  BlogPayload,
  ContentType,
  SaveContentDto,
  ShortPayload,
} from '@castcle-api/database/dtos';
import { generateMockUsers, MockUserDetail } from '@castcle-api/database/mocks';
import {
  ContentDocument,
  CredentialDocument,
  UserDocument,
} from '@castcle-api/database/schemas';
import {
  ContentProducer,
  NotificationProducer,
  TopicName,
  UserProducer,
} from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ContentController } from './app.controller';
import { AppService } from './app.service';

const fakeProcessor = jest.fn();
const fakeBull = BullModule.registerQueue({
  name: TopicName.Users,
  redis: {
    host: '0.0.0.0',
    port: 6380,
  },
  processors: [fakeProcessor],
});
const fakeBull2 = BullModule.registerQueue({
  name: TopicName.Contents,
  redis: {
    host: '0.0.0.0',
    port: 6380,
  },
  processors: [fakeProcessor],
});
const fakeBull3 = BullModule.registerQueue({
  name: TopicName.Notifications,
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

describe('ContentController', () => {
  let app: TestingModule;
  let contentController: ContentController;
  let service: UserService;
  let appService: AppService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userCredential: CredentialDocument;
  let user: UserDocument;
  let payloadId: any;

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
        fakeBull2,
        fakeBull3,
      ],
      controllers: [ContentController],
      providers: [
        AppService,
        UserService,
        AuthenticationService,
        ContentService,
        CaslAbilityFactory,
        UserProducer,
        ContentProducer,
        NotificationProducer,
        NotificationService,
        HashtagService,
      ],
    }).compile();
    service = app.get<UserService>(UserService);
    appService = app.get<AppService>(AppService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    contentController = app.get<ContentController>(ContentController);
    jest
      .spyOn(appService, 'uploadContentToS3')
      .mockImplementation(async (body: SaveContentDto) => {
        //let body: SaveContentDto = JSON.parse(JSON.stringify(refBody));
        if (body.payload.photo && body.payload.photo.contents) {
          body.payload.photo.contents = body.payload.photo.contents.map(
            (item) => {
              return {
                original: item.image,
              };
            }
          );
        }

        return body;
      });
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
    userCredential = await authService.getCredentialFromAccessToken(
      result.credentialDocument.accessToken
    ); //result.credentialDocument;
    user = await service.getUserFromCredential(userCredential);
    console.debug('======USER FROM TEST=====');
    console.debug(user);
    await service.createPageFromUser(user, {
      castcleId: 'pageTest',
      displayName: 'pageTest',
    });
  });
  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('createFeedContent', () => {
    it('should create a new short content from DTO', async () => {
      const shortPayload = {
        message: 'อุบกขา',
        photo: {
          contents: [
            {
              image: 'testImage',
            },
          ],
        },
        link: [
          {
            type: 'other',
            url: 'https://www.facebook.com/watch/?v=345357500470873',
          },
        ],
      } as ShortPayload;
      const result = await contentController.createFeedContent(
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any
      );
      expect(result.payload.id).toBeDefined();
      expect(result.payload.type).toEqual(ContentType.Short);
      expect(result.payload).toBeDefined();
      //expect(result.payload.payload).toEqual(shortPayload);
      const content = await contentService.getContentFromId(result.payload.id);

      expect(result.payload).toEqual(content.toContentPayloadItem());

      expect(result.payload.authorId).toEqual(user._id);
    });
    it('should create a new blog content from DTO', async () => {
      const blogPayload = {
        header: 'How to be a centinare',
        message: 'Sell quick',
        photo: {
          cover: {
            image: 'http://placehold.it/500x500',
          },
          contents: [
            { image: 'http://placehold.it/200x200' },
            { image: 'http://placehold.it/300x300' },
          ],
        },
      } as BlogPayload;
      const result = await contentController.createFeedContent(
        {
          payload: blogPayload,
          type: ContentType.Blog,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any
      );
      expect(result.payload.id).toBeDefined();
      expect(result.payload.type).toEqual(ContentType.Blog);
      expect(result.payload.photo).toEqual(blogPayload.photo);
      expect(result.payload.message).toEqual(blogPayload.message);
      await contentService.getContentFromId(result.payload.id);
      //expect(result.payload.).toEqual(content.toContentPayload());
      expect(result.payload.authorId).toEqual(user._id);
    });
    it('should be able to create a content by page', async () => {
      const pageDto = {
        avatar: {
          original: 'http://placehold.it/200x200',
        },
        cover: {
          original: 'http://placehold.it/1200x500',
        },
        displayName: 'Whatsupidoo',
        castcleId: 'whatsup',
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
            url: 'https://www.facebook.com/watch/?v=345357500470873',
          },
        ],
      } as ShortPayload;
      const result = await contentController.createFeedContent(
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: newPage.displayId,
        },
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any
      );
      payloadId = result.payload.id;
      expect(result.payload.authorId).toEqual(newPage._id);
    });
  });
  describe('getContentFromId', () => {
    it('should be able to get a content that has been created', async () => {
      const shortPayload = {
        message: 'อุบกขาxx',
        photo: {
          contents: [
            {
              image: 'testImage',
            },
          ],
        },
        link: [
          {
            type: 'other',
            url: 'https://www.facebook.com/watch/?v=345357500470873',
          },
        ],
      } as ShortPayload;
      const actual = await contentController.createFeedContent(
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any
      );
      console.debug('createResult', actual.payload.authorId);
      const expected = await contentController.getContentFromId(
        actual.payload.id,
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any
      );
      expected.payload.photo.contents[0].original =
        actual.payload.photo.contents[0].original;
      expect(JSON.stringify(expected)).toEqual(JSON.stringify(actual));
    });
  });

  describe('updateContentFromId', () => {
    it('should be able to update a posted content', async () => {
      const shortPayload = {
        message: 'อุบกขา',
        photo: {
          contents: [{ image: 'testImage' }],
        },
        link: [
          {
            type: 'other',
            url: 'https://www.facebook.com/watch/?v=345357500470873',
          },
        ],
      } as ShortPayload;

      const result = await contentController.createFeedContent(
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any
      );

      const updateContentPayload = { message: 'Hello World' } as ShortPayload;
      const updateResult = await contentController.updateContentFromId(
        {
          payload: updateContentPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        result.payload.id,
        { hasRelationshipExpansion: false },
        { $credential: userCredential, $language: 'th' } as any
      );

      expect(updateResult.payload.message).toEqual(
        updateContentPayload.message
      );

      const getResult = await contentController.getContentFromId(
        result.payload.id,
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any
      );

      expect(getResult.payload).toEqual(updateResult.payload);
    });

    it('should be able to update page content', async () => {
      const updateResult = await contentController.updateContentFromId(
        {
          type: 'short',
          payload: { message: 'hi bro' },
          castcleId: 'whats up',
        },
        payloadId as string,
        { hasRelationshipExpansion: false },
        { $credential: userCredential, $language: 'en' } as any
      );

      expect(updateResult.payload.message).toEqual('hi bro');
    });
  });

  describe('deleteContentFromId() ', () => {
    it('it should be able to delete from page', async () => {
      const deleteResult = await contentController.deleteContentFromId(
        payloadId as string,
        { $credential: userCredential, $language: 'th' } as any
      );
      expect(deleteResult).toEqual(undefined);
      const getContentResultService = await contentService.getContentFromId(
        payloadId as string
      );
      expect(getContentResultService).toBeNull();
    });
  });

  describe('#getUserRecasted', () => {
    let contentA: ContentDocument;
    let mockUsers: MockUserDetail[] = [];
    beforeAll(async () => {
      mockUsers = await generateMockUsers(5, 0, {
        userService: service,
        accountService: authService,
      });

      //userA create a content
      contentA = await contentService.createContentFromUser(mockUsers[0].user, {
        payload: {
          message: 'hello world',
        } as ShortPayload,
        type: ContentType.Short,
        castcleId: user.displayId,
      });

      await contentService.recastContentFromUser(contentA, mockUsers[1].user);
      await contentService.recastContentFromUser(contentA, mockUsers[2].user);
      await contentService.recastContentFromUser(contentA, mockUsers[3].user);
      await contentService.recastContentFromUser(contentA, mockUsers[4].user);
    });

    it('should get all recast content users', async () => {
      const result = await contentController.getUserRecasted(
        {
          $credential: userCredential,
          $language: 'th',
        } as any,
        contentA.id,
        { hasRelationshipExpansion: false }
      );
      expect(result).toBeDefined();
      expect(result.payload.length).toEqual(4);
      expect(result.meta.resultTotal).toEqual(4);

      const resultHasRelation = await contentController.getUserRecasted(
        {
          $credential: userCredential,
          $language: 'th',
        } as any,
        contentA.id,
        { hasRelationshipExpansion: true }
      );
      expect(resultHasRelation).toBeDefined();
      expect(resultHasRelation.payload.length).toEqual(4);
      expect(resultHasRelation.meta.resultTotal).toEqual(4);
    });
  });
});
