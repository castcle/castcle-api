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
  AnalyticService,
  CommentServiceV2,
  ContentService,
  ContentType,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationServiceV2,
  QueueName,
  SocialSyncServiceV2,
  User,
  UserServiceV2,
} from '@castcle-api/database';
import { CastcleMongooseModule } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { Downloader } from '@castcle-api/utils/aws';
import { Mailer } from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Repository } from 'libs/database/src/lib/repositories';
import { CommentControllerV2 } from './comment.controller.v2';

describe('CommentControllerV2', () => {
  let app: TestingModule;
  let commentController: CommentControllerV2;
  let contentService: ContentService;
  let user: User;
  let authorizer: Authorizer;

  beforeAll(async () => {
    app = await TestingModule.createWithDb({
      imports: [
        CastcleMongooseModule,
        CacheModule.register(),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
        JwtModule,
      ],
      controllers: [CommentControllerV2],
      providers: [
        AnalyticService,
        CommentServiceV2,
        ContentService,
        HashtagService,
        Mailer,
        NotificationServiceV2,
        Repository,
        UserServiceV2,
        { provide: SocialSyncServiceV2, useValue: {} },
        { provide: Downloader, useValue: {} },
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
        {
          provide: getQueueToken(QueueName.REPORTING),
          useValue: { add: jest.fn() },
        },
      ],
    });

    contentService = app.get<ContentService>(ContentService);
    commentController = app.get<CommentControllerV2>(CommentControllerV2);
  });

  afterAll(() => {
    return app.close();
  });

  beforeEach(async () => {
    const created = await app.createUser();
    authorizer = new Authorizer(created.account, created.user, 'uuid');
    user = created.user;
  });

  afterEach(() => {
    return app.cleanDb();
  });

  describe('#getAllComment()', () => {
    it('should display all comments', async () => {
      const content = await contentService.createContentFromUser(user, {
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
        { contentId: content.id },
        authorizer,
        { hasRelationshipExpansion: false },
      );
      expect(comments.payload.length).toEqual(2);
      expect(comments.includes).toBeDefined();
      expect(comments.meta).toBeDefined();
    });
  });

  describe('#getAllReplyComment()', () => {
    it('should display all reply comments', async () => {
      const content = await contentService.createContentFromUser(user, {
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
        { contentId: content.id },
        { sourceCommentId: comment.id },
        authorizer,
        { hasRelationshipExpansion: false },
      );
      expect(replyComments.payload.length).toEqual(1);
      expect(replyComments.includes).toBeDefined();
      expect(replyComments.meta).toBeDefined();
    });
  });
});
