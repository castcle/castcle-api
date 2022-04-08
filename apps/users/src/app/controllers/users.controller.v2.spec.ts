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
  SocialSyncServiceV2,
  TAccountService,
  UserService,
} from '@castcle-api/database';
import {
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
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SuggestionService } from '../services/suggestion.service';
import { UsersControllerV2 } from './users.controller.v2';

export class DownloaderMock {
  getImageFromUrl() {
    return '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';
  }
}

export class FacebookClientMock {
  subscribed(userToken: string, socialId: string) {
    console.log(userToken);
    console.log(socialId);
    return true;
  }
}

describe('CommentControllerV2', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let appController: UsersControllerV2;
  let service: UserService;
  let authService: AuthenticationService;
  let contentService: ContentService;
  let commentService: CommentServiceV2;

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
        UserService,
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
    service = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    commentService = app.get<CommentServiceV2>(CommentServiceV2);
    appController = app.get<UsersControllerV2>(UsersControllerV2);
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('#Comment()', () => {
    let mocksUsers: MockUserDetail[];
    let content;
    let comment;
    beforeAll(async () => {
      mocksUsers = await generateMockUsers(3, 0, {
        userService: service,
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
        comment.payload.id,
        { message: 'zup' },
        { userId: user.displayId } as GetUserParam
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
        appController.updateComment(
          authorizer,
          comment.payload.id,
          { message: 'zup edit' },
          { userId: user.displayId } as GetUserParam
        )
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
        appController.deleteComment(authorizer, comment.payload.id, {
          userId: user.displayId,
        } as GetUserParam)
      ).rejects.toEqual(CastcleException.FORBIDDEN);
    });

    it('deleteComment() should delete a comment', async () => {
      const user = mocksUsers[1].user;
      const authorizer = new Authorizer(
        mocksUsers[1].account,
        user,
        mocksUsers[1].credential
      );
      appController.deleteComment(authorizer, comment.payload.id, {
        userId: user.displayId,
      } as GetUserParam);
      const result = await commentService.getCommentsByContentId(
        user,
        comment.payload.id,
        { maxResults: 5, hasRelationshipExpansion: false }
      );
      expect(result.payload.length).toEqual(0);
    });
  });
});
