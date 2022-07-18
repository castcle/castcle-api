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

import {
  AuthenticationService,
  BlogPayload,
  Content,
  ContentService,
  ContentType,
  Credential,
  HashtagService,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  QueueName,
  SaveContentDto,
  ShortPayload,
  User,
  UserService,
  generateMockUsers,
} from '@castcle-api/database';
import { Authorizer } from '@castcle-api/utils/decorators';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppService } from '../services/app.service';
import { ContentController } from './content.controller';

describe('ContentController', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let contentController: ContentController;
  let service: UserService;
  let appService: AppService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userCredential: Credential;
  let user: User;
  let authorizer: Authorizer;
  let payloadId: any;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      controllers: [ContentController],
      providers: [
        AppService,
        UserService,
        AuthenticationService,
        ContentService,
        NotificationService,
        HashtagService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
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
        if (body.payload.photo && body.payload.photo.contents) {
          body.payload.photo.contents = body.payload.photo.contents.map(
            (item) => {
              return {
                original: item.image,
              };
            },
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
      },
    );
    await authService.verifyAccount(accountActivation);
    userCredential = await authService.getCredentialFromAccessToken(
      result.credentialDocument.accessToken,
    ); //result.credentialDocument;
    user = await service.getUserFromCredential(userCredential);
    authorizer = new Authorizer(
      await authService.getAccountFromCredential(userCredential),
      user,
      userCredential,
    );
    await service.createPageFromUser(user, {
      castcleId: 'pageTest',
      displayName: 'pageTest',
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
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
        authorizer,
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
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
        authorizer,
        {
          payload: blogPayload,
          type: ContentType.Blog,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
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
        pageDto,
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
        authorizer,
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: newPage.displayId,
        },
        { hasRelationshipExpansion: false },
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
        authorizer,
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
      );
      console.debug('createResult', actual.payload.authorId);
      const expected = await contentController.getContentFromId(
        actual.payload.id,
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any,
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
        authorizer,
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
      );

      const updateContentPayload = { message: 'Hello World' } as ShortPayload;
      const updateResult = await contentController.updateContentFromId(
        authorizer,
        {
          payload: updateContentPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        result.payload.id,
        { hasRelationshipExpansion: false },
      );

      expect(updateResult.payload.message).toEqual(
        updateContentPayload.message,
      );

      const getResult = await contentController.getContentFromId(
        result.payload.id,
        { hasRelationshipExpansion: false },
        {
          $credential: userCredential,
          $language: 'th',
        } as any,
      );

      expect(getResult.payload).toEqual(updateResult.payload);
    });

    it('should be able to update page content', async () => {
      const updateResult = await contentController.updateContentFromId(
        authorizer,
        {
          type: ContentType.Short,
          payload: { message: 'hi bro' },
          castcleId: 'whats up',
        },
        payloadId as string,
        { hasRelationshipExpansion: false },
      );

      expect(updateResult.payload.message).toEqual('hi bro');
    });
  });

  describe('deleteContentFromId() ', () => {
    it('it should be able to delete from page', async () => {
      const deleteResult = await contentController.deleteContentFromId(
        authorizer,
        payloadId as string,
      );
      expect(deleteResult).toEqual(undefined);
      const getContentResultService = await contentService.getContentFromId(
        payloadId as string,
      );
      expect(getContentResultService).toBeNull();
    });
  });

  describe('#getUserRecasted', () => {
    let contentA: Content;
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
        { hasRelationshipExpansion: false },
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
        { hasRelationshipExpansion: true },
      );
      expect(resultHasRelation).toBeDefined();
      expect(resultHasRelation.payload.length).toEqual(4);
      expect(resultHasRelation.meta.resultTotal).toEqual(4);
    });
  });

  describe('#getLikingCast', () => {
    let contentMock: Content;
    let engagement: any = [];
    let relationUser: any = [];
    let userMock: MockUserDetail[] = [];
    let response: any = [];

    let relationStatus;
    beforeAll(async () => {
      userMock = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService,
      });

      contentMock = await contentService.createContentFromUser(
        userMock[0].user,
        {
          payload: {
            message: 'hello world',
          } as ShortPayload,
          type: ContentType.Short,
          castcleId: userMock[0].user.displayId,
        },
      );

      engagement = await new contentService._engagementModel({
        type: 'like',
        user: user.id,
        account: user.ownerAccount,
        targetRef: {
          $ref: 'content',
          $id: contentMock.id,
        },
        visibility: 'publish',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).save();
      engagement.user = user;

      await new service._relationshipModel({
        followedUser: user.id,
        user: userMock[0].user.id,
        isFollowPage: false,
        visibility: 'publish',
        blocking: false,
        following: true,
      }).save();

      jest
        .spyOn(contentService, 'getLikingCastUser')
        .mockResolvedValueOnce({ total: 1, items: [engagement] });
    });

    it('should create get liking', async () => {
      await contentController._getContentIfExist(contentMock.id);

      const engagements: any = await contentService.getLikingCastUser(
        contentMock.id,
        100,
        null,
        null,
      );

      if (!userCredential.account.isGuest) {
        relationUser = engagements.items.map((e) => {
          return e.user.id;
        });

        relationUser = await service.getRelationshipData(
          true,
          relationUser,
          userMock[0].user.id,
        );
      }

      for await (const obj of engagements.items) {
        relationStatus = await relationUser.filter(
          (e) => String(e.followedUser) === String(obj.user.id),
        );

        if (relationStatus.length) {
          relationStatus = relationStatus[0];
          if (!relationStatus.blocking) {
            response = [
              ...response,
              await obj.user.toUserResponse({
                blocked: relationStatus.blocking,
                blocking: relationStatus.blocking,
                followed: relationStatus.following,
              }),
            ];
          }
        } else {
          const result = await obj.user.toUserResponse();
          result.blocked = false;
          result.blocking = false;
          result.followed = false;
          response = [...response, result];
        }
      }

      expect(response).toHaveLength(1);
      expect(response[0].followed).toEqual(true);
      expect(response[0].blocked).toEqual(false);
      expect(response[0].blocking).toEqual(false);
      expect(String(response[0].id)).toMatch(String(user._id));
    });
    afterAll(() => {
      service._relationshipModel.deleteMany({});
      service._userModel.deleteMany({});
      contentService._contentModel.deleteMany({});
      contentService._engagementModel.deleteMany({});
    });
  });

  describe('#getParticipates', () => {
    it('should be able to get a content participates', async () => {
      const shortPayload = {
        message: 'content participates test',
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
        authorizer,
        {
          payload: shortPayload,
          type: ContentType.Short,
          castcleId: user.displayId,
        },
        { hasRelationshipExpansion: false },
      );

      const expected = await contentController.getParticipates(
        actual.payload.id,
        {
          $credential: userCredential,
          $language: 'th',
        } as any,
      );
      expect(expected.payload[0].user).toBeDefined();
      expect(expected.payload[0].participate).toBeDefined();
    });
  });
});
