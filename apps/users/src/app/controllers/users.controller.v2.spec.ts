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
  AdsService,
  AnalyticService,
  AuthenticationService,
  AuthenticationServiceV2,
  CampaignService,
  Comment,
  CommentParam,
  CommentServiceV2,
  Content,
  ContentService,
  ContentServiceV2,
  ContentType,
  DataService,
  EngagementType,
  EntityVisibility,
  GetContentDto,
  GetContentQuery,
  GetDateDto,
  GetSourceContentParam,
  GetUserParam,
  HashtagService,
  KeywordType,
  MockUserDetail,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  NotificationServiceV2,
  NotificationType,
  QueueName,
  QuoteCastDto,
  RankerService,
  ReplyCommentParam,
  ShortPayload,
  SocialProvider,
  SocialSyncServiceV2,
  SuggestionServiceV2,
  TAccountService,
  UnlikeCommentCastParam,
  UserService,
  UserServiceV2,
  WalletShortcutService,
  generateMockUsers,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { Downloader } from '@castcle-api/utils/aws';
import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { DownloaderMock } from 'libs/utils/aws/src/lib/downloader.spec';
import { FacebookClientMock } from 'libs/utils/clients/src/lib/facebook/facebook.client.spec';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SuggestionService } from '../services/suggestion.service';
import { WalletService } from '../services/wallet.service';
import { UsersControllerV2 } from './users.controller.v2';

describe('UsersControllerV2', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let appController: UsersControllerV2;
  let service: UserServiceV2;
  let repository: Repository;
  let authService: AuthenticationService;
  let authServiceV2: AuthenticationServiceV2;
  let contentService: ContentService;
  let userServiceV1: UserService;
  let socialSyncService: SocialSyncServiceV2;

  beforeAll(async () => {
    const DownloaderProvider = {
      provide: Downloader,
      useClass: DownloaderMock,
    };

    const FacebookClientProvider = {
      provide: FacebookClient,
      useClass: FacebookClientMock,
    };

    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
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
      controllers: [UsersControllerV2],
      providers: [
        { provide: DataService, useValue: {} },
        AdsService,
        AnalyticService,
        AuthenticationService,
        AuthenticationServiceV2,
        CampaignService,
        CommentServiceV2,
        ContentService,
        ContentServiceV2,
        DownloaderProvider,
        FacebookClientProvider,
        HashtagService,
        Mailer,
        NotificationService,
        NotificationServiceV2,
        RankerService,
        Repository,
        SocialSyncServiceV2,
        SuggestionService,
        SuggestionServiceV2,
        TAccountService,
        UserService,
        UserServiceV2,
        WalletService,
        WalletShortcutService,
        { provide: GoogleClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        { provide: TwilioClient, useValue: {} },
        { provide: Mailer, useValue: { sendRegistrationEmail: jest.fn() } },
        { provide: DataService, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.CAMPAIGN),
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
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(UserServiceV2);
    repository = moduleRef.get(Repository);
    userServiceV1 = moduleRef.get(UserService);
    authService = moduleRef.get(AuthenticationService);
    authServiceV2 = moduleRef.get(AuthenticationServiceV2);
    socialSyncService = moduleRef.get(SocialSyncServiceV2);
    contentService = moduleRef.get(ContentService);
    appController = moduleRef.get(UsersControllerV2);
  });

  describe('#Comment()', () => {
    let mocksUsers: MockUserDetail[];
    let content;
    let comment;
    let replyComment;
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(3, 0, {
        userService: userServiceV1,
        accountService: authService,
      });

      content = await contentService.createContentFromUser(mocksUsers[0].user, {
        type: ContentType.Short,
        payload: {
          message: 'Hi Jack',
        } as ShortPayload,
        castcleId: mocksUsers[0].user.displayId,
      });
    });

    it('createComment() should be able to create a comment content', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential,
      );
      comment = await appController.createComment(
        authorizer,
        {
          message: 'hello',
          contentId: content._id,
        },
        { userId: user.id } as GetUserParam,
      );

      expect(comment.payload).toBeDefined();
      expect(comment.includes).toBeDefined();
    });

    it('createComment() return Exception when use wrong content id', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential,
      );
      await expect(
        appController.createComment(
          authorizer,
          {
            message: 'hello',
            contentId: '624a7c01df5d0069d04655da',
          },
          { userId: user.id } as GetUserParam,
        ),
      ).rejects.toEqual(new CastcleException('CONTENT_NOT_FOUND'));
    });

    it('updateComment() should update a message of comment', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential,
      );
      const updateComment = await appController.updateComment(
        authorizer,
        { message: 'zup' },
        {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam,
      );
      expect(updateComment.payload).toBeDefined();
    });

    it('updateComment() return Exception when use wrong account', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential,
      );
      await expect(
        appController.updateComment(authorizer, { message: 'zup edit' }, {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam),
      ).rejects.toEqual(new CastcleException('CONTENT_NOT_FOUND'));
    });

    it('replyComment() should be able create a comment in comment(reply)', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential,
      );
      replyComment = await appController.replyComment(
        authorizer,
        {
          message: 'hello reply',
        },
        {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam,
      );

      expect(replyComment.payload).toBeDefined();
      expect(replyComment.includes).toBeDefined();
    });

    it('deleteComment() return Exception when use wrong account', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential,
      );
      await expect(
        appController.deleteComment(authorizer, {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });

    it('deleteComment() should delete a comment', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential,
      );
      await appController.deleteComment(authorizer, {
        userId: user.displayId,
        sourceCommentId: comment.payload.id,
      } as CommentParam);
      const resultComment = await contentService.getCommentById(
        comment.payload.id,
      );

      const resultReply = await contentService.getCommentById(
        replyComment.payload.id,
      );
      expect(resultComment).toBeNull();
      expect(resultReply).toBeNull();
    });
  });

  describe('#ReplyComment()', () => {
    let mocksUsers: MockUserDetail[];
    let content;
    let comment;
    let replyComment;
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(3, 0, {
        userService: userServiceV1,
        accountService: authService,
      });

      content = await contentService.createContentFromUser(mocksUsers[0].user, {
        type: ContentType.Short,
        payload: {
          message: 'Hi Jack',
        } as ShortPayload,
        castcleId: mocksUsers[0].user.displayId,
      });

      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential,
      );
      comment = await appController.createComment(
        authorizer,
        {
          message: 'hello',
          contentId: content._id,
        },
        { userId: user.id } as GetUserParam,
      );
    });

    afterAll(async () => {
      await (service as any).userModel.deleteMany({});
    });

    it('replyComment() should be able to reply a comment', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential,
      );
      replyComment = await appController.replyComment(
        authorizer,
        {
          message: 'Yo hello',
        },
        {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam,
      );

      expect(replyComment.payload).toBeDefined();
      expect(replyComment.includes).toBeDefined();
    });

    it('replyComment() return Exception when use wrong comment id', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential,
      );
      await expect(
        appController.replyComment(
          authorizer,
          {
            message: 'hello',
          },
          {
            userId: user.displayId,
            sourceCommentId: '624a7c01df5d0069d04655da',
          } as CommentParam,
        ),
      ).rejects.toEqual(new CastcleException('CONTENT_NOT_FOUND'));
    });

    it('updateReplyComment() should update a message of reply comment', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential,
      );
      const updateReplyComment = await appController.updateReplyComment(
        authorizer,
        { message: 'Yo zup' },
        {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
          replyCommentId: replyComment.payload.id,
        } as ReplyCommentParam,
      );
      expect(updateReplyComment.payload).toBeDefined();
    });

    it('updateReplyComment() return Exception when use wrong account', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential,
      );
      await expect(
        appController.updateReplyComment(authorizer, { message: 'zup edit' }, {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
          replyCommentId: replyComment.payload.id,
        } as ReplyCommentParam),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });

    it('deleteReplyComment() return Exception when use wrong account', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential,
      );
      await expect(
        appController.deleteReplyComment(authorizer, {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
          replyCommentId: replyComment.payload.id,
        } as ReplyCommentParam),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });

    it('deleteReplyComment() should delete a comment', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential,
      );
      await appController.deleteReplyComment(authorizer, {
        userId: user.displayId,
        sourceCommentId: comment.payload.id,
        replyCommentId: replyComment.payload.id,
      } as ReplyCommentParam);
      const resultComment = await contentService.getCommentById(
        comment.payload.id,
      );

      const resultReply = await contentService.getCommentById(
        replyComment.payload.id,
      );
      expect(resultComment).toBeDefined();
      expect(resultReply).toBeNull();
    });
  });
  describe('#like', () => {
    let mocksUsers: MockUserDetail[];
    let content: Content;
    let comment: Comment;
    let reply: Comment;

    beforeAll(async () => {
      mocksUsers = await generateMockUsers(4, 0, {
        userService: userServiceV1,
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

      reply = await contentService.replyComment(user, comment, {
        message: 'nice #baby',
      });
    });
    describe('#likeCast()', () => {
      it('should create like cast.', async () => {
        const authorizer = new Authorizer(
          mocksUsers[1].account,
          mocksUsers[1].user,
          mocksUsers[1].credential,
        );
        await appController.likeCast(authorizer, { contentId: content._id }, {
          userId: mocksUsers[1].user._id,
        } as GetUserParam);

        const engagement = await contentService._engagementModel.findOne({
          user: mocksUsers[1].user._id,
          type: EngagementType.Like,
          targetRef: {
            $ref: 'content',
            $id: content._id,
          },
        });

        expect(engagement).toBeTruthy();
        expect(String(engagement.user)).toEqual(String(mocksUsers[1].user._id));
        expect(String(engagement.targetRef.oid)).toEqual(String(content._id));
        expect(engagement.type).toEqual(NotificationType.Like);
      });
    });
    describe('#likeCommentCast()', () => {
      it('should create like comment cast.', async () => {
        const authorizer = new Authorizer(
          mocksUsers[2].account,
          mocksUsers[2].user,
          mocksUsers[2].credential,
        );
        await appController.likeCommentCast(
          authorizer,
          { commentId: comment._id },
          {
            userId: mocksUsers[2].user._id,
          } as GetUserParam,
        );

        const engagement = await contentService._engagementModel.findOne({
          user: mocksUsers[2].user._id,
          targetRef: {
            $ref: 'comment',
            $id: comment._id,
          },
        });

        expect(engagement).toBeTruthy();
        expect(String(engagement.user)).toEqual(String(mocksUsers[2].user._id));
        expect(String(engagement.targetRef.oid)).toEqual(String(comment._id));
        expect(engagement.type).toEqual(NotificationType.Like);
      });
      it('should create like reply comment cast.', async () => {
        const authorizer = new Authorizer(
          mocksUsers[3].account,
          mocksUsers[3].user,
          mocksUsers[3].credential,
        );

        await appController.likeCommentCast(
          authorizer,
          { commentId: reply._id },
          {
            userId: mocksUsers[3].user._id,
          } as GetUserParam,
        );

        const engagement = await contentService._engagementModel.findOne({
          user: mocksUsers[3].user._id,
          targetRef: {
            $ref: 'comment',
            $id: reply._id,
          },
        });

        expect(engagement).toBeTruthy();
        expect(String(engagement.user)).toEqual(String(mocksUsers[3].user._id));
        expect(String(engagement.targetRef.oid)).toEqual(String(reply._id));
        expect(engagement.type).toEqual(NotificationType.Like);
      });
    });
    afterAll(async () => {
      await contentService._engagementModel.deleteMany({});
      await contentService._contentModel.deleteMany({});
      await contentService._commentModel.deleteMany({});
    });
  });

  describe('#unlike', () => {
    let mocksUsers: MockUserDetail[];
    let content: Content;
    let comment: Comment;
    let reply: Comment;

    beforeAll(async () => {
      mocksUsers = await generateMockUsers(4, 0, {
        userService: userServiceV1,
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

      reply = await contentService.replyComment(user, comment, {
        message: 'nice #baby',
      });
    });
    describe('#unlikeCast()', () => {
      it('should delete like comment cast.', async () => {
        const authorizer = new Authorizer(
          mocksUsers[1].account,
          mocksUsers[1].user,
          mocksUsers[1].credential,
        );
        await appController.unlikeCast(authorizer, {
          userId: mocksUsers[1].user._id,
          sourceContentId: content._id,
        } as GetSourceContentParam);

        const engagement = await contentService._engagementModel.findOne({
          user: mocksUsers[1].user._id,
          targetRef: {
            $ref: 'content',
            $id: content._id,
          },
        });

        expect(engagement).toBeNull();
      });
    });
    describe('#unlikeCommentCast()', () => {
      it('should delete unlike comment cast.', async () => {
        const authorizer = new Authorizer(
          mocksUsers[2].account,
          mocksUsers[2].user,
          mocksUsers[2].credential,
        );
        await appController.unlikeCommentCast(authorizer, {
          userId: mocksUsers[2].user._id,
          sourceCommentId: content._id,
        } as UnlikeCommentCastParam);

        const engagement = await contentService._engagementModel.findOne({
          user: mocksUsers[2].user._id,
          targetRef: {
            $ref: 'content',
            $id: content._id,
          },
        });

        expect(engagement).toBeNull();
      });
      it('should delete unlike reply comment cast.', async () => {
        const authorizer = new Authorizer(
          mocksUsers[3].account,
          mocksUsers[3].user,
          mocksUsers[3].credential,
        );
        await appController.unlikeCommentCast(authorizer, {
          userId: mocksUsers[3].user._id,
          sourceCommentId: content._id,
        } as UnlikeCommentCastParam);

        const engagement = await contentService._engagementModel.findOne({
          user: mocksUsers[2].user._id,
          targetRef: {
            $ref: 'comment',
            $id: reply._id,
          },
        });

        expect(engagement).toBeNull();
      });
    });
  });
  describe('#recast', () => {
    let mocksUsers: MockUserDetail[];
    let content: Content;
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(4, 0, {
        userService: userServiceV1,
        accountService: authService,
      });

      const user = mocksUsers[0].user;
      content = await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });
    describe('#recast', () => {
      describe('#recastContent()', () => {
        it('should recast is correct.', async () => {
          const authorizer = new Authorizer(
            mocksUsers[1].account,
            mocksUsers[1].user,
            mocksUsers[1].credential,
          );
          const recast = await appController.recastContent(
            authorizer,
            {
              contentId: content._id,
            } as GetContentDto,
            {
              userId: mocksUsers[1].user._id,
            } as GetUserParam,
          );

          const engagement = await repository.findEngagement({
            user: mocksUsers[1].user._id,
            targetRef: {
              $ref: 'content',
              $id: content._id,
            },
            type: EngagementType.Recast,
          });

          expect(engagement.user).toEqual(mocksUsers[1].user._id);
          expect(String(engagement.itemId)).toEqual(String(recast.payload.id));
          expect(engagement.targetRef.oid).toEqual(content._id);
          expect(engagement.type).toEqual(EngagementType.Recast);

          expect(recast.payload.authorId).toEqual(mocksUsers[1].user._id);
          expect(recast.payload.referencedCasts.id).toEqual(content._id);
          expect(String(recast.includes.casts[0].id)).toEqual(
            String(content._id),
          );
        });
      });
      describe('#undoRecast()', () => {
        it('should undo recast is correct.', async () => {
          const authorizer = new Authorizer(
            mocksUsers[2].account,
            mocksUsers[2].user,
            mocksUsers[2].credential,
          );
          const recast = await appController.recastContent(
            authorizer,
            {
              contentId: content._id,
            } as GetContentDto,
            {
              userId: mocksUsers[2].user._id,
            } as GetUserParam,
          );

          await appController.undoRecast(authorizer, {
            userId: mocksUsers[2].user._id,
            sourceContentId: content._id,
          } as GetSourceContentParam);

          const findContent = await repository.findContent({
            originalPost: content._id,
            author: mocksUsers[2].user._id,
          });

          const engagement = await repository.findEngagement({
            user: mocksUsers[2].user._id,
            itemId: recast.payload.id,
            type: EngagementType.Recast,
          });

          expect(findContent).toBeNull();
          expect(engagement).toBeNull();
        });
      });
    });
  });

  describe('#quoteContent()', () => {
    let mocksUsers: MockUserDetail[];
    let content: Content;

    beforeAll(async () => {
      mocksUsers = await generateMockUsers(4, 0, {
        userService: userServiceV1,
        accountService: authService,
      });

      const user = mocksUsers[0].user;
      content = await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });
    it('should quote cast is correct.', async () => {
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        mocksUsers[1].user,
        mocksUsers[1].credential,
      );
      const quotecast = await appController.quoteContent(
        authorizer,
        {
          contentId: content._id,
          message: 'quote cast',
        } as QuoteCastDto,
        {
          userId: mocksUsers[1].user._id,
        } as GetUserParam,
      );

      const engagement = await repository.findEngagement({
        user: mocksUsers[1].user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id,
        },
        type: EngagementType.Quote,
      });

      expect(engagement.user).toEqual(mocksUsers[1].user._id);
      expect(String(engagement.itemId)).toEqual(String(quotecast.payload.id));
      expect(engagement.targetRef.oid).toEqual(content._id);
      expect(engagement.type).toEqual(EngagementType.Quote);

      expect(quotecast.payload.authorId).toEqual(mocksUsers[1].user._id);
      expect(quotecast.payload.referencedCasts.id).toEqual(content._id);
      expect(String(quotecast.includes.casts[0].id)).toEqual(
        String(content._id),
      );
    });
  });

  describe('#getContents()', () => {
    let mocksUsers: MockUserDetail[];

    beforeAll(async () => {
      mocksUsers = await generateMockUsers(4, 0, {
        userService: userServiceV1,
        accountService: authService,
      });

      const user = mocksUsers[0].user;
      await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });
      await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });
    it('should get cast is exists.', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
      const contentResp = await appController.getContents(
        authorizer,
        {
          userId: mocksUsers[0].user._id,
        } as GetUserParam,
        { hasRelationshipExpansion: false } as GetContentQuery,
      );

      expect(contentResp.payload).toHaveLength(2);
    });
  });

  describe('getUserByKeyword', () => {
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(20, 0, {
        userService: userServiceV1,
        accountService: authService,
      });
    });
    it('should get user by keyword', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getUserByKeyword = await appController.getUserByKeyword(
        authorizer,
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: 'mock-10',
          },
          hasRelationshipExpansion: false,
        },
      );

      expect(getUserByKeyword.payload).toHaveLength(1);
    });

    it('should get user by keyword is empty', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const getUserByKeyword = await appController.getUserByKeyword(
        authorizer,
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: 'empty',
          },
          hasRelationshipExpansion: false,
        },
      );

      expect(getUserByKeyword.payload).toHaveLength(0);
    });
    afterAll(async () => {
      await userServiceV1._accountModel.deleteMany({});
      await userServiceV1._userModel.deleteMany({});
    });
  });

  describe('Social Sync', () => {
    let mocksUsers: MockUserDetail[];
    let syncId;
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(1, 0, {
        userService: userServiceV1,
        accountService: authService,
      });
      const newSync = await new (socialSyncService as any).socialSyncModel({
        socialId: 'socialid',
        provider: SocialProvider.Facebook,
        userName: 'username',
        displayName: 'displayName',
        avatar: '',
        active: true,
        autoPost: false,
        account: mocksUsers[0].user.ownerAccount,
        user: mocksUsers[0].user._id,
        visibility: EntityVisibility.Publish,
      }).save();

      syncId = newSync._id;
    });

    it('should update sync social auto post equal true', async () => {
      const socialSync = await (socialSyncService as any).setAutoPost(
        syncId,
        String(mocksUsers[0].user._id),
        true,
      );

      expect(socialSync.autoPost).toEqual(true);
    });
    it('should update sync social auto post equal false', async () => {
      const socialSync = await (socialSyncService as any).setAutoPost(
        syncId,
        String(mocksUsers[0].user._id),
        false,
      );

      expect(socialSync.autoPost).toEqual(false);
    });

    it('should delete sync social', async () => {
      await (socialSyncService as any).disconnectSocialSync(
        syncId,
        String(mocksUsers[0].user._id),
      );

      const socialSync = await (
        socialSyncService as any
      ).repository.findSocialSync({ _id: syncId });

      expect(socialSync).toBeNull();
    });
  });

  describe('updatePDPA', () => {
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(2, 0, {
        userService: userServiceV1,
        accountService: authService,
      });

      Environment.PDPA_ACCEPT_DATES = ['20200701', '20200601'];
    });

    it('should get user data pdpa in response', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
      const userResponse = await appController.updatePDPA(authorizer, {
        date: '20200701',
      } as GetDateDto);

      expect(userResponse.pdpa).toBeTruthy();
    });
  });

  describe('getReferee', () => {
    let mocksUsers: MockUserDetail[];

    beforeAll(async () => {
      mocksUsers = await generateMockUsers(1, 0, {
        userService: userServiceV1,
        accountService: authService,
      });

      const guestDemo = await authService.createAccount({
        deviceUUID: `testuuid1`,
        languagesPreferences: ['th', 'th'],
        header: {
          platform: 'ios',
        },
        device: `testdevice1`,
      });

      await authServiceV2.registerWithEmail(guestDemo.credentialDocument, {
        hostUrl: 'http://test.com',
        ip: '0.0.0.0',
        email: `test1@gmail.com`,
        password: '12345678Ab',
        displayName: `Test1`,
        castcleId: `test1`,
        referral: mocksUsers[0].user.displayId,
      });
    });
    it('should get user referee', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );

      const referee = await appController.getReferee(
        authorizer,
        {
          userId: mocksUsers[0].user._id,
        } as GetUserParam,
        { hasRelationshipExpansion: false },
      );

      expect(referee.payload).toHaveLength(1);
    });
  });

  describe('getReferrer', () => {
    let mocksUsers: MockUserDetail[];
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(1, 0, {
        userService: userServiceV1,
        accountService: authService,
      });
    });
    it('should get user referrer', async () => {
      const authorizer = new Authorizer(
        mocksUsers[0].account,
        mocksUsers[0].user,
        mocksUsers[0].credential,
      );
      const referrer = await appController.getReferrer(
        authorizer,
        {
          userId: mocksUsers[0].user._id,
        } as GetUserParam,
        {
          hasRelationshipExpansion: false,
        },
      );

      expect(referrer.payload).not.toBeNull();
    });
  });
});
