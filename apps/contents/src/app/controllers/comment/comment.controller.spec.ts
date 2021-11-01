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
import { CommentController } from './comment.controller';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CaslAbilityFactory } from '@castcle-api/casl';
import {
  AccountDocument,
  ContentDocument,
  CredentialDocument,
  UserDocument
} from '@castcle-api/database/schemas';
import {
  BlogPayload,
  ContentPayloadDto,
  PageDto
} from '@castcle-api/database/dtos';
import { ContentType, ShortPayload } from '@castcle-api/database/dtos';
import { UserType } from '@castcle-api/database/schemas';
import { TopicName, UserProducer } from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';

const fakeProcessor = jest.fn();
const fakeBull = BullModule.registerQueue({
  name: TopicName.Users,
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

describe('CommentController', () => {
  let app: TestingModule;
  let commentController: CommentController;
  let service: UserService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userAccount: AccountDocument;
  let userCredential: CredentialDocument;
  let user: UserDocument;
  let content: ContentDocument;
  let userCredentialRequest: any;
  let rootCommentId: any;
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
        fakeBull
      ],
      controllers: [CommentController],
      providers: [
        UserService,
        AuthenticationService,
        ContentService,
        CaslAbilityFactory,
        UserProducer
      ]
    }).compile();
    service = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    commentController = app.get<CommentController>(CommentController);
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
        password: '2@HelloWorld'
      }
    );
    userAccount = await authService.verifyAccount(accountActivation);
    userCredential = await authService.getCredentialFromAccessToken(
      result.credentialDocument.accessToken
    ); //result.credentialDocument;
    user = await service.getUserFromCredential(userCredential);
    content = await contentService.createContentFromUser(user, {
      type: ContentType.Short,
      payload: {
        message: 'Hi Jack'
      } as ShortPayload,
      castcleId: user.displayId
    });
    userCredentialRequest = {
      $credential: userCredential,
      $language: 'th'
    } as any;
  });
  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('#createComment()', () => {
    it('should be able to create a comment content', async () => {
      const commentResult = await commentController.createComment(
        content._id,
        {
          feedItemId: 'nothing',
          message: 'hello',
          castcleId: user.displayId
        },
        userCredentialRequest
      );
      //console.log(commentResult.payload)
      expect(commentResult.payload).toBeDefined();
      rootCommentId = commentResult.payload.id;
    });
  });
  describe('#replyComment()', () => {
    it('should be able create a comment in comment(reply)', async () => {
      const replyResult = await commentController.replyComment(
        content._id,
        rootCommentId,
        { message: 'yo', castcleId: user.displayId },
        userCredentialRequest
      );
      expect(replyResult.payload).toBeDefined();
    });
  });
  describe('#getAllComment()', () => {
    it('should display all comments', async () => {
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest
      );
      expect(comments.payload.length).toEqual(1);
      expect(comments.payload[0].reply.length).toEqual(1);
    });
  });

  describe('#likeComment()', () => {
    it('should be able to like a comment', async () => {
      const result = await commentController.likeComment(
        content._id,
        rootCommentId,
        { castcleId: user.displayId, feedItemId: 'test' },
        userCredentialRequest
      );
      expect(result).toEqual('');
    });
    it('should update like engagement', async () => {
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest
      );
      expect(comments.payload[0].like.count).toEqual(1);
      const result = await commentController.likeComment(
        content._id,
        rootCommentId,
        { castcleId: user.displayId, feedItemId: 'test' },
        userCredentialRequest
      );
      const comments2 = await commentController.getAllComment(
        content._id,
        userCredentialRequest
      );
      expect(comments2.payload[0].like.count).toEqual(1);
    });
  });
  describe('#unlikeComment()', () => {
    it('should unlike a like of comment', async () => {
      const result = await commentController.unlikeComment(
        content._id,
        rootCommentId,
        {
          castcleId: user.displayId,
          feedItemId: 'test'
        },
        userCredentialRequest
      );
      expect(result).toEqual('');
    });
    it('should update like engagement', async () => {
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest
      );
      expect(comments.payload[0].like.count).toEqual(0);
      const result = await commentController.unlikeComment(
        content._id,
        rootCommentId,
        { castcleId: user.displayId, feedItemId: 'test' },
        userCredentialRequest
      );
      const comments2 = await commentController.getAllComment(
        content._id,
        userCredentialRequest
      );
      expect(comments2.payload[0].like.count).toEqual(0);
    });
  });
  describe('#updateComment()', () => {
    it('should update a message of comment', async () => {
      const updateComment = await commentController.updateComment(
        content._id,
        rootCommentId,
        { message: 'zup' },
        userCredentialRequest
      );
      expect(updateComment.payload).toBeDefined();
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest
      );
      expect(comments.payload[0]).toEqual(updateComment.payload);
    });
  });
  describe('#deleteComment()', () => {
    it('should delete a comment', async () => {
      const deleteComment = await commentController.deleteComment(
        content._id,
        rootCommentId,
        userCredentialRequest
      );
      expect(deleteComment).toEqual('');
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest
      );
      expect(comments.payload.length).toEqual(0);
    });
  });
});
