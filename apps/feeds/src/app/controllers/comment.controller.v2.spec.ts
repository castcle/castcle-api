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
  CommentServiceV2,
  Content,
  ContentService,
  ContentType,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  NotificationServiceV2,
  QueueName,
  User,
  UserService,
  generateMockUsers,
} from '@castcle-api/database';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CommentControllerV2 } from './comment.controller.v2';

describe('CommentControllerV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let commentController: CommentControllerV2;
  let service: UserService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let user: User;
  let content: Content;
  let credential;

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
        HttpModule,
      ],
      controllers: [CommentControllerV2],
      providers: [
        UserService,
        AuthenticationService,
        ContentService,
        CommentServiceV2,
        NotificationService,
        NotificationServiceV2,
        HashtagService,
        Repository,
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
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    commentController = app.get<CommentControllerV2>(CommentControllerV2);
    const mocksUsers = await generateMockUsers(1, 0, {
      userService: service,
      accountService: authService,
    });

    user = mocksUsers[0].user;
    credential = {
      $credential: mocksUsers[0].credential,
      $language: 'th',
    } as any;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('#getAllComment()', () => {
    it('should display all comments', async () => {
      content = await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });

      await contentService.createCommentForContent(user, content, {
        message: 'Hello #hello v2',
      });

      await contentService.createCommentForContent(user, content, {
        message: 'Hello #hello v2 #2',
      });

      const comments = await commentController.getAllComment(
        content.id,
        credential,
        { hasRelationshipExpansion: false },
      );
      expect(comments.payload.length).toEqual(2);
      expect(comments.includes).toBeDefined();
      expect(comments.meta).toBeDefined();
    });
  });

  describe('#getAllReplyComment()', () => {
    it('should display all reply comments', async () => {
      content = await contentService.createContentFromUser(user, {
        payload: { message: 'hi reply v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });

      const comment = await contentService.createCommentForContent(
        user,
        content,
        {
          message: 'Hello #hello v2',
        },
      );

      await contentService.replyComment(user, comment, {
        message: 'Reply #hello v2 #2',
      });

      const replyComments = await commentController.getAllReplyComment(
        content.id,
        comment.id,
        credential,
        { hasRelationshipExpansion: false },
      );
      expect(replyComments.payload.length).toEqual(1);
      expect(replyComments.includes).toBeDefined();
      expect(replyComments.meta).toBeDefined();
    });
  });
});
