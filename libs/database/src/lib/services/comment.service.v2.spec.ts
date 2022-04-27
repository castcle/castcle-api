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
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
} from '../database.module';
import { ContentType, NotificationType } from '../dtos';
import { generateMockUsers, MockUserDetail } from '../mocks/user.mocks';
import { QueueName } from '../models';
import { Comment, Content } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { CommentServiceV2 } from './comment.service.v2';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { NotificationServiceV2 } from './notification.service.v2';
import { UserService } from './user.service';

describe('CommentServiceV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let service: CommentServiceV2;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let userService: UserService;
  let comment: Comment;
  let reply: Comment;
  let content: Content;
  let mocksUsers: MockUserDetail[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        AuthenticationService,
        CommentServiceV2,
        ContentService,
        HashtagService,
        UserService,
        NotificationService,
        NotificationServiceV2,
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

    authService = app.get(AuthenticationService);
    contentService = app.get(ContentService);
    service = app.get(CommentServiceV2);
    userService = app.get(UserService);

    mocksUsers = await generateMockUsers(3, 0, {
      userService: userService,
      accountService: authService,
    });

    const user = mocksUsers[0].user;
    content = await contentService.createContentFromUser(user, {
      payload: { message: 'hi v2' },
      type: ContentType.Short,
      castcleId: user.displayId,
    });

    comment = await contentService.createCommentForContent(user, content, {
      message: 'Hello #hello v2',
    });

    await contentService.replyComment(user, comment, {
      message: 'nice #baby',
    });
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('#convertCommentToCommentResponse', () => {
    it('should return comment in type of CommentResponse', async () => {
      const user = mocksUsers[0].user;
      const response = await service.convertCommentToCommentResponse(
        user,
        comment,
        [],
        { hasRelationshipExpansion: false }
      );

      expect(response.includes.users[0].followed).toBeUndefined();
      expect(response.payload.metrics.likeCount).toEqual(
        comment.engagements.like.count
      );
    });

    it('should return comment in type of CommentResponse with relationships', async () => {
      const user = mocksUsers[0].user;
      const response = await service.convertCommentToCommentResponse(
        user,
        comment,
        [],
        { hasRelationshipExpansion: true }
      );
      expect(response.includes.users[0].followed).toBeDefined();
    });
  });

  describe('#getCommentsByContentId()', () => {
    it('should get comment and reply from content', async () => {
      const user = mocksUsers[0].user;
      const commentsResult = await service.getCommentsByContentId(
        user,
        content._id,
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        }
      );

      expect(commentsResult.meta.resultCount).toEqual(1);
    });
  });

  describe('#getCommentById()', () => {
    it('should get comment and reply from comment id', async () => {
      const user = mocksUsers[0].user;
      const commentsResult = await service.getCommentsById(user, comment._id);

      expect(commentsResult.payload.length).toEqual(1);
    });
  });

  describe('#getReplyCommentsByCommentId()', () => {
    it('should get reply comment from content', async () => {
      const user = mocksUsers[0].user;
      const replyComments = await service.getReplyCommentsByCommentId(
        user,
        comment._id,
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        }
      );
      expect(replyComments.meta.resultCount).toEqual(1);
    });
  });

  describe('#deleteComment()', () => {
    it('should remove a reply from comment', async () => {
      const user = mocksUsers[0].user;
      const preComment = await service.commentModel
        .findById(comment._id)
        .exec();
      expect(preComment.engagements.comment.count).toEqual(1);
      await service.deleteComment(comment);
      const postReply = await service.commentModel.findById(comment._id).exec();
      expect(postReply).toBeNull();
      const comments = await service.getCommentsByContentId(user, content._id, {
        maxResults: 5,
        hasRelationshipExpansion: false,
      });
      expect(comments.meta.resultCount).toEqual(0);
    });
  });
  describe('#likeCommentCast()', () => {
    beforeAll(async () => {
      const user = mocksUsers[0].user;
      content = await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });

      comment = await contentService.createCommentForContent(user, content, {
        message: 'Hello #hello v2',
      });

      reply = await contentService.replyComment(user, comment, {
        message: 'nice #baby',
      });
    });
    it('should like comment cast', async () => {
      const likeCommentCast = await service.likeCommentCast(
        undefined,
        comment,
        content,
        mocksUsers[1].user,
        mocksUsers[1].account
      );
      const engagement = await service._engagementModel.findOne({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'comment',
          $id: likeCommentCast._id,
        },
      });

      expect(engagement.type).toEqual(NotificationType.Like);
      expect(String(engagement.user)).toEqual(String(mocksUsers[1].user._id));
      expect(String(engagement.targetRef.oid)).toEqual(
        String(likeCommentCast._id)
      );
    });

    it('should like reply comment cast', async () => {
      const likeCommentCast = await service.likeCommentCast(
        comment,
        reply,
        content,
        mocksUsers[1].user,
        mocksUsers[1].account
      );
      const engagement = await service._engagementModel.findOne({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'comment',
          $id: likeCommentCast._id,
        },
      });

      expect(engagement.type).toEqual(NotificationType.Like);
      expect(String(engagement.user)).toEqual(String(mocksUsers[1].user._id));
      expect(String(engagement.targetRef.oid)).toEqual(
        String(likeCommentCast._id)
      );
    });
    afterAll(async () => {
      await service._engagementModel.deleteMany({});
      await contentService._contentModel.deleteMany({});
      await contentService._commentModel.deleteMany({});
    });
  });
  describe('#unlikeCommentCast', () => {
    beforeAll(async () => {
      const user = mocksUsers[0].user;
      content = await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });

      comment = await contentService.createCommentForContent(user, content, {
        message: 'Hello #hello v2',
      });

      reply = await contentService.replyComment(user, comment, {
        message: 'nice #baby',
      });
    });
    it('should unlike comment cast', async () => {
      await service.likeCommentCast(
        undefined,
        comment,
        content,
        mocksUsers[1].user,
        mocksUsers[1].account
      );

      const unlikeCommentCast = await service.unlikeCommentCast(
        comment._id,
        mocksUsers[1].user
      );

      const engagement = await service._engagementModel.findOne({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'comment',
          $id: unlikeCommentCast._id,
        },
      });
      expect(engagement).toBeNull();
      expect(unlikeCommentCast.type).toEqual(NotificationType.Like);
      expect(String(unlikeCommentCast.user)).toEqual(
        String(mocksUsers[1].user._id)
      );
      expect(String(unlikeCommentCast.targetRef.oid)).toEqual(
        String(comment._id)
      );
    });
    it('should unlike reply comment cast', async () => {
      await service.likeCommentCast(
        comment,
        reply,
        content,
        mocksUsers[2].user,
        mocksUsers[2].account
      );

      const unlikeCommentCast = await service.unlikeCommentCast(
        reply._id,
        mocksUsers[2].user
      );

      const engagement = await service._engagementModel.findOne({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'comment',
          $id: unlikeCommentCast._id,
        },
      });
      expect(engagement).toBeNull();
      expect(unlikeCommentCast.type).toEqual(NotificationType.Like);
      expect(String(unlikeCommentCast.user)).toEqual(
        String(mocksUsers[2].user._id)
      );
      expect(String(unlikeCommentCast.targetRef.oid)).toEqual(
        String(reply._id)
      );
    });
  });
});
