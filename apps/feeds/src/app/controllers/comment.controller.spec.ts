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
  CommentService,
  Content,
  ContentService,
  ContentType,
  Credential,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  QueueName,
  RankerService,
  ShortPayload,
  User,
  UserService,
} from '@castcle-api/database';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SuggestionService } from '../services/suggestion.service';
import { CommentController } from './comment.controller';

export class RankingMock {}

export class SuggestionMock {}
describe('CommentController', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let commentController: CommentController;
  let service: UserService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userCredential: Credential;
  let user: User;
  let content: Content;
  let userCredentialRequest: any;
  let rootCommentId: any;

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
      controllers: [CommentController],
      providers: [
        UserService,
        AuthenticationService,
        ContentService,
        CommentService,
        NotificationService,
        HashtagService,
        {
          provide: RankerService,
          useValue: { getFeedItem: jest.fn(), seenFeedItem: jest.fn() },
        },
        {
          provide: SuggestionService,
          useValue: { seen: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();
    service = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    commentController = app.get<CommentController>(CommentController);
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
        password: '2@HelloWorld',
      },
    );
    await authService.verifyAccount(accountActivation);
    userCredential = await authService.getCredentialFromAccessToken(
      result.credentialDocument.accessToken,
    ); //result.credentialDocument;
    user = await service.getUserFromCredential(userCredential);
    content = await contentService.createContentFromUser(user, {
      type: ContentType.Short,
      payload: {
        message: 'Hi Jack',
      } as ShortPayload,
      castcleId: user.displayId,
    });
    userCredentialRequest = {
      $credential: userCredential,
      $language: 'th',
    } as any;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('#createComment()', () => {
    it('should be able to create a comment content', async () => {
      const commentResult = await commentController.createComment(
        content._id,
        {
          message: 'hello',
          castcleId: user.displayId,
        },
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );

      expect(commentResult.payload).toBeDefined();
      rootCommentId = commentResult.payload.id;
    });
  });
  describe('#replyComment()', () => {
    it('should be able create a comment in comment(reply)', async () => {
      const replyResult = await commentController.replyComment(
        rootCommentId,
        { message: 'yo', castcleId: user.displayId },
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );
      expect(replyResult.payload).toBeDefined();
    });
  });
  describe('#getAllComment()', () => {
    it('should display all comments', async () => {
      const comments = await commentController.getAllComment(
        content.id,
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );
      expect(comments.payload.length).toEqual(1);
      expect(comments.payload[0].reply.length).toEqual(1);
    });
  });

  describe('#likeComment()', () => {
    it('should be able to like a comment', async () => {
      await commentController.likeComment(
        userCredentialRequest,
        content._id,
        rootCommentId,
        { castcleId: user.displayId, feedItemId: 'test' },
      );
      const engagement = await contentService._engagementModel.findOne({
        targetRef: {
          $ref: 'comment',
          $id: rootCommentId,
        },
      });

      expect(String(engagement.targetRef.oid)).toEqual(String(rootCommentId));
      expect(String(engagement.targetRef.namespace)).toEqual('comment');
    });
    it('should update like engagement', async () => {
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );
      expect(comments.payload[0].metrics.likeCount).toEqual(1);

      const comments2 = await commentController.getAllComment(
        content._id,
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );

      expect(comments2.payload[0].metrics.likeCount).toEqual(1);
    });
  });
  describe('#unlikeComment()', () => {
    it('should unlike a like of comment', async () => {
      const result = await commentController.unlikeComment(rootCommentId, {
        castcleId: user.displayId,
        feedItemId: 'test',
      });
      expect(result).toEqual('');
    });
    it('should update like engagement', async () => {
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );
      expect(comments.payload[0].metrics.likeCount).toEqual(0);
      await commentController.unlikeComment(rootCommentId, {
        castcleId: user.displayId,
        feedItemId: 'test',
      });
      const comments2 = await commentController.getAllComment(
        content._id,
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );
      expect(comments2.payload[0].metrics.likeCount).toEqual(0);
    });
  });
  describe('#updateComment()', () => {
    it('should update a message of comment', async () => {
      const updateComment = await commentController.updateComment(
        rootCommentId,
        { message: 'zup' },
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );
      expect(updateComment.payload).toBeDefined();
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );
      expect(comments.payload[0]).toEqual(updateComment.payload);
    });
  });
  describe('#deleteComment()', () => {
    it('should delete a comment', async () => {
      const deleteComment = await commentController.deleteComment(
        rootCommentId,
      );
      expect(deleteComment).toEqual('');
      const comments = await commentController.getAllComment(
        content._id,
        userCredentialRequest,
        { hasRelationshipExpansion: false },
      );
      expect(comments.payload.length).toEqual(0);
    });
  });
});
