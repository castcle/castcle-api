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
  CampaignService,
  CommentServiceV2,
  ContentService,
  DataService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  QueueName,
  RankerService,
  SocialSyncServiceV2,
  TAccountService,
  UserService,
  UserServiceV2,
} from '@castcle-api/database';
import {
  CommentParam,
  ContentType,
  GetUserParam,
  ShortPayload,
} from '@castcle-api/database/dtos';
import { generateMockUsers, MockUserDetail } from '@castcle-api/database/mocks';
import { Downloader } from '@castcle-api/utils/aws';
import { FacebookClient } from '@castcle-api/utils/clients';
import { Authorizer } from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DownloaderMock } from 'libs/utils/aws/src/lib/downloader.spec';
import { FacebookClientMock } from 'libs/utils/clients/src/lib/facebook/facebook.client.spec';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SuggestionService } from '../services/suggestion.service';
import { UsersControllerV2 } from './users.controller.v2';

describe('CommentControllerV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let appController: UsersControllerV2;
  let service: UserServiceV2;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let commentService: CommentServiceV2;
  let userServiceV1: UserService;

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
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      controllers: [UsersControllerV2],
      providers: [
        { provide: DataService, useValue: {} },
        UserServiceV2,
        AuthenticationService,
        ContentService,
        HashtagService,
        SocialSyncServiceV2,
        CampaignService,
        TAccountService,
        SuggestionService,
        AdsService,
        AnalyticService,
        NotificationService,
        DownloaderProvider,
        FacebookClientProvider,
        CommentServiceV2,
        UserService,
        RankerService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
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
      ],
    }).compile();

    service = app.get<UserServiceV2>(UserServiceV2);
    userServiceV1 = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    commentService = app.get<CommentServiceV2>(CommentServiceV2);
    appController = app.get<UsersControllerV2>(UsersControllerV2);
  });

  describe('#Comment()', () => {
    let mocksUsers: MockUserDetail[];
    let content;
    let comment;
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

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });
    it('createComment() should be able to create a comment content', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential
      );
      comment = await appController.createComment(
        authorizer,
        {
          message: 'hello',
          contentId: content._id,
        },
        { userId: user.id } as GetUserParam
      );

      expect(comment.payload).toBeDefined();
      expect(comment.includes).toBeDefined();
    });

    it('createComment() return Exception when use wrong content id', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential
      );
      await expect(
        appController.createComment(
          authorizer,
          {
            message: 'hello',
            contentId: '624a7c01df5d0069d04655da',
          },
          { userId: user.id } as GetUserParam
        )
      ).rejects.toEqual(CastcleException.CONTENT_NOT_FOUND);
    });

    it('updateComment() should update a message of comment', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential
      );
      const updateComment = await appController.updateComment(
        authorizer,
        { message: 'zup' },
        {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam
      );
      expect(updateComment.payload).toBeDefined();
    });

    it('updateComment() return Exception when use wrong account', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential
      );
      await expect(
        appController.updateComment(authorizer, { message: 'zup edit' }, {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam)
      ).rejects.toEqual(CastcleException.FORBIDDEN);
    });

    it('deleteComment() return Exception when use wrong account', async () => {
      const user = mocksUsers[2].user;
      const authorizer = new Authorizer(
        mocksUsers[2].account,
        user,
        mocksUsers[2].credential
      );
      await expect(
        appController.deleteComment(authorizer, {
          userId: user.displayId,
          sourceCommentId: comment.payload.id,
        } as CommentParam)
      ).rejects.toEqual(CastcleException.FORBIDDEN);
    });

    it('deleteComment() should delete a comment', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential
      );
      appController.deleteComment(authorizer, {
        userId: user.displayId,
        sourceCommentId: comment.payload.id,
      } as CommentParam);
      const resultComment = await commentService.getCommentsByContentId(
        user,
        comment.payload.id,
        { maxResults: 5, hasRelationshipExpansion: false }
      );

      expect(resultComment.payload.length).toEqual(0);
    });
  });
});
