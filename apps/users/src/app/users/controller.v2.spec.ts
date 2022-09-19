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
  AuthenticationServiceV2,
  Comment,
  CommentParam,
  CommentResponse,
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
  MongooseAsyncFeatures,
  MongooseForFeatures,
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
  User,
  UserServiceV2,
  WalletShortcutService,
} from '@castcle-api/database';
import { CastcleMongooseModule, Environment } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
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
import { JwtModule } from '@nestjs/jwt';
import { Repository } from 'libs/database/src/lib/repositories';
import { CreatedUser } from 'libs/testing/src/lib/testing.dto';
import { DownloaderMock } from 'libs/utils/aws/src/lib/downloader.spec';
import { FacebookClientMock } from 'libs/utils/clients/src/lib/facebook/facebook.client.spec';
import { UsersControllerV2 } from './controller.v2';
import { UpdateMobileService } from './services/update-mobile/service.abstract';
import { UpdateMobileServiceImpl } from './services/update-mobile/service.implementation';

describe('UsersControllerV2', () => {
  let testingModule: TestingModule;
  let appController: UsersControllerV2;
  let repository: Repository;
  let contentService: ContentService;
  let socialSyncService: SocialSyncServiceV2;
  let mocksUsers: CreatedUser[];
  let authorizers: Authorizer[];
  let content: Content;

  beforeAll(async () => {
    testingModule = await TestingModule.createWithDb({
      imports: [
        CastcleMongooseModule,
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
        JwtModule,
      ],
      controllers: [UsersControllerV2],
      providers: [
        { provide: UpdateMobileService, useClass: UpdateMobileServiceImpl },
        { provide: DataService, useValue: {} },
        AdsService,
        AnalyticService,
        AuthenticationServiceV2,
        CommentServiceV2,
        ContentService,
        ContentServiceV2,
        {
          provide: Downloader,
          useClass: DownloaderMock,
        },
        {
          provide: FacebookClient,
          useClass: FacebookClientMock,
        },
        HashtagService,
        Mailer,
        NotificationServiceV2,
        RankerService,
        Repository,
        SocialSyncServiceV2,
        SuggestionServiceV2,
        TAccountService,
        UserServiceV2,
        WalletShortcutService,
        { provide: GoogleClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        { provide: TwilioClient, useValue: {} },
        { provide: Mailer, useValue: { sendRegistrationEmail: jest.fn() } },
        { provide: DataService, useValue: {} },
        {
          provide: getQueueToken(QueueName.NEW_TRANSACTION),
          useValue: { add: jest.fn() },
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
          provide: getQueueToken(QueueName.REPORTING),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.VERIFY_EMAIL),
          useValue: { add: jest.fn() },
        },
      ],
    });

    repository = testingModule.get(Repository);
    socialSyncService = testingModule.get(SocialSyncServiceV2);
    contentService = testingModule.get(ContentService);
    appController = testingModule.get(UsersControllerV2);
  });

  afterAll(() => {
    return testingModule.close();
  });

  afterEach(() => {
    return testingModule.cleanDb();
  });

  beforeEach(async () => {
    mocksUsers = await Promise.all(
      Array.from({ length: 4 }, () => testingModule.createUser()),
    );
    content = await contentService.createContentFromUser(mocksUsers[0].user, {
      type: ContentType.Short,
      payload: { message: 'Hi Jack' } as ShortPayload,
      castcleId: mocksUsers[0].user.displayId,
    });
    authorizers = mocksUsers.map(
      (m) => new Authorizer(m.account, m.user, 'uuid'),
    );
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  describe('#Comment()', () => {
    let comment: CommentResponse;

    beforeEach(async () => {
      comment = await appController.createComment(
        authorizers[1],
        {
          message: 'hello',
          contentId: content._id,
        },
        { userId: authorizers[1].user.id } as GetUserParam,
      );
    });

    it('createComment() should be able to create a comment content', async () => {
      expect(comment.payload).toBeDefined();
      expect(comment.includes).toBeDefined();
    });

    it('createComment() return Exception when use wrong content id', async () => {
      await expect(
        appController.createComment(
          authorizers[1],
          {
            message: 'hello',
            contentId: '624a7c01df5d0069d04655da',
          },
          { userId: authorizers[1].user.id } as GetUserParam,
        ),
      ).rejects.toEqual(new CastcleException('CONTENT_NOT_FOUND'));
    });

    it('updateComment() should update a message of comment', async () => {
      const updateComment = await appController.updateComment(
        authorizers[1],
        { message: 'zup' },
        {
          userId: authorizers[1].user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam,
      );
      expect(updateComment.payload).toBeDefined();
    });

    it('updateComment() return Exception when use wrong account', async () => {
      await expect(
        appController.updateComment(authorizers[2], { message: 'zup edit' }, {
          userId: authorizers[2].user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam),
      ).rejects.toEqual(new CastcleException('CONTENT_NOT_FOUND'));
    });

    it('replyComment() should be able create a comment in comment(reply)', async () => {
      const replyComment = await appController.replyComment(
        authorizers[2],
        {
          message: 'hello reply',
        },
        {
          userId: authorizers[2].user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam,
      );

      expect(replyComment.payload).toBeDefined();
      expect(replyComment.includes).toBeDefined();
    });

    it('deleteComment() return Exception when use wrong account', async () => {
      await expect(
        appController.deleteComment(authorizers[2], {
          userId: authorizers[2].user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });

    it('deleteComment() should delete a comment', async () => {
      await appController.deleteComment(authorizers[1], {
        userId: authorizers[1].user.id,
        sourceCommentId: comment.payload.id,
      } as CommentParam);
      const resultComment = await contentService.getCommentById(
        comment.payload.id,
      );

      const resultReply = await contentService.getCommentById(
        comment.payload.id,
      );
      expect(resultComment).toBeNull();
      expect(resultReply).toBeNull();
    });
  });

  describe('#ReplyComment()', () => {
    let comment: CommentResponse;
    let replyComment: CommentResponse;

    beforeEach(async () => {
      comment = await appController.createComment(
        authorizers[2],
        {
          message: 'hello',
          contentId: content._id,
        },
        { userId: authorizers[2].user.id } as GetUserParam,
      );
      replyComment = await appController.replyComment(
        authorizers[2],
        {
          message: 'Yo hello',
        },
        {
          userId: authorizers[2].user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam,
      );
    });

    it('replyComment() should be able to reply a comment', async () => {
      expect(replyComment.payload).toBeDefined();
      expect(replyComment.includes).toBeDefined();
    });

    it('replyComment() return Exception when use wrong comment id', async () => {
      await expect(
        appController.replyComment(
          authorizers[2],
          {
            message: 'hello',
          },
          {
            userId: authorizers[2].user.displayId,
            sourceCommentId: '624a7c01df5d0069d04655da',
          } as CommentParam,
        ),
      ).rejects.toEqual(new CastcleException('CONTENT_NOT_FOUND'));
    });

    it('updateReplyComment() should update a message of reply comment', async () => {
      const updateReplyComment = await appController.updateReplyComment(
        authorizers[2],
        { message: 'Yo zup' },
        {
          userId: authorizers[2].user.displayId,
          sourceCommentId: comment.payload.id,
          replyCommentId: replyComment.payload.id,
        } as ReplyCommentParam,
      );
      expect(updateReplyComment.payload).toBeDefined();
    });

    it('updateReplyComment() return Exception when use wrong account', async () => {
      await expect(
        appController.updateReplyComment(
          authorizers[1],
          { message: 'zup edit' },
          {
            userId: authorizers[1].user.displayId,
            sourceCommentId: comment.payload.id,
            replyCommentId: replyComment.payload.id,
          } as ReplyCommentParam,
        ),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });

    it('deleteReplyComment() return Exception when use wrong account', async () => {
      await expect(
        appController.deleteReplyComment(authorizers[1], {
          userId: authorizers[1].user.displayId,
          sourceCommentId: comment.payload.id,
          replyCommentId: replyComment.payload.id,
        } as ReplyCommentParam),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });

    it('deleteReplyComment() should delete a comment', async () => {
      await appController.deleteReplyComment(authorizers[2], {
        userId: authorizers[2].user.displayId,
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
    let content: Content;
    let comment: Comment;
    let reply: Comment;

    beforeEach(async () => {
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
        await appController.likeCast(
          authorizers[1],
          { contentId: content._id },
          {
            userId: mocksUsers[1].user._id,
          } as GetUserParam,
        );

        const engagement = await testingModule.getModel('Engagement').findOne({
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
        await appController.likeCommentCast(
          authorizers[2],
          { commentId: comment._id },
          {
            userId: mocksUsers[2].user._id,
          } as GetUserParam,
        );

        const engagement = await testingModule.getModel('Engagement').findOne({
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
        await appController.likeCommentCast(
          authorizers[3],
          { commentId: reply._id },
          {
            userId: mocksUsers[3].user._id,
          } as GetUserParam,
        );

        const engagement = await testingModule.getModel('Engagement').findOne({
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
  });

  describe('#unlike', () => {
    let content: Content;
    let comment: Comment;
    let reply: Comment;

    beforeEach(async () => {
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
        await appController.unlikeCast(authorizers[1], {
          userId: mocksUsers[1].user._id,
          sourceContentId: content._id,
        } as GetSourceContentParam);

        const engagement = await testingModule.getModel('Engagement').findOne({
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
        await appController.unlikeCommentCast(authorizers[2], {
          userId: mocksUsers[2].user._id,
          sourceCommentId: content._id,
        } as UnlikeCommentCastParam);

        const engagement = await testingModule.getModel('Engagement').findOne({
          user: mocksUsers[2].user._id,
          targetRef: {
            $ref: 'content',
            $id: content._id,
          },
        });

        expect(engagement).toBeNull();
      });

      it('should delete unlike reply comment cast.', async () => {
        await appController.unlikeCommentCast(authorizers[3], {
          userId: mocksUsers[3].user._id,
          sourceCommentId: content._id,
        } as UnlikeCommentCastParam);

        const engagement = await testingModule.getModel('Engagement').findOne({
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
    let content: Content;

    beforeEach(async () => {
      const user = mocksUsers[0].user;
      content = await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });

    describe('#recastContent()', () => {
      it('should recast is correct.', async () => {
        const recast = await appController.recastContent(
          authorizers[1],
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
        const recast = await appController.recastContent(
          authorizers[2],
          {
            contentId: content._id,
          } as GetContentDto,
          {
            userId: mocksUsers[2].user._id,
          } as GetUserParam,
        );

        await appController.undoRecast(authorizers[2], {
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

  describe('#quoteContent()', () => {
    let content: Content;

    beforeAll(async () => {
      const user = mocksUsers[0].user;
      content = await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });
    });

    it('should quote cast is correct.', async () => {
      const quotecast = await appController.quoteContent(
        authorizers[1],
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
    it('should get cast is exists.', async () => {
      const user: User = mocksUsers[0].user;
      await contentService.createContentFromUser(user, {
        payload: { message: 'hi v2' },
        type: ContentType.Short,
        castcleId: user.displayId,
      });
      const contentResp = await appController.getContents(
        authorizers[0],
        { userId: user._id } as GetUserParam,
        { hasRelationshipExpansion: false } as GetContentQuery,
      );

      expect(contentResp.payload).toHaveLength(2);
    });
  });

  describe('getUserByKeyword', () => {
    it('should get user by keyword', async () => {
      const getUserByKeyword = await appController.getUserByKeyword(
        authorizers[0],
        {
          maxResults: 25,
          keyword: {
            type: KeywordType.Mention,
            input: authorizers[0].user.displayId,
          },
          hasRelationshipExpansion: false,
        },
      );

      expect(getUserByKeyword.payload).toHaveLength(1);
    });

    it('should get user by keyword is empty', async () => {
      const getUserByKeyword = await appController.getUserByKeyword(
        authorizers[0],
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
  });

  describe('Social Sync', () => {
    let syncId: any;

    beforeEach(async () => {
      const newSync = await new (testingModule.getModel('SocialSync'))({
        socialId: 'social-id',
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

      const socialSync = await repository.findSocialSync({ _id: syncId });

      expect(socialSync).toBeNull();
    });
  });

  describe('updatePDPA', () => {
    beforeAll(async () => {
      Environment.PDPA_ACCEPT_DATES = ['20200701', '20200601'];
    });

    it('should get user data pdpa in response', async () => {
      const userResponse = await appController.updatePDPA(authorizers[0], {
        date: '20200701',
      } as GetDateDto);

      expect(userResponse.pdpa).toBeTruthy();
    });
  });

  describe('getReferee', () => {
    beforeEach(async () => {
      await testingModule.createUser({
        castcleId: 'referee',
        referrer: mocksUsers[0].account._id,
      });
    });

    it('should get user referee', async () => {
      const referee = await appController.getReferee(
        authorizers[0],
        {
          userId: mocksUsers[0].user._id,
        } as GetUserParam,
        { hasRelationshipExpansion: false },
      );

      expect(referee.payload).toHaveLength(1);
    });
  });

  describe('getReferrer', () => {
    it('should get user referrer', async () => {
      const created = await testingModule.createUser({
        castcleId: 'referee',
        referrer: mocksUsers[0].account._id,
      });
      const referrer = await appController.getReferrer(
        new Authorizer(created.account, created.user, 'uuid'),
        {
          userId: created.user._id,
        } as GetUserParam,
        {
          hasRelationshipExpansion: false,
        },
      );

      expect(referrer.payload).not.toBeNull();
    });
  });
});
