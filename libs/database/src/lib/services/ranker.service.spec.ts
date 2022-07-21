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
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { ShortPayload } from '../dtos';
import { ContentType, QueueName } from '../models';
import { Repository } from '../repositories';
import { Account, Content, Credential, User } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { DataService } from './data.service';
import { HashtagService } from './hashtag.service';
import { RankerService } from './ranker.service';
import { UserService } from './user.service';

describe('Ranker Service', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: RankerService;
  let contentService: ContentService;
  let userService: UserService;
  let authService: AuthenticationService;
  let user: User;
  let follower: User;
  let followerAccount: Account;
  const contents: Content[] = [];
  let result: {
    accountDocument: Account;
    credentialDocument: Credential;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        ContentService,
        UserService,
        AuthenticationService,
        RankerService,
        Repository,
        HashtagService,
        { provide: DataService, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get<RankerService>(RankerService);
    contentService = moduleRef.get<ContentService>(ContentService);
    userService = moduleRef.get<UserService>(UserService);
    authService = moduleRef.get<AuthenticationService>(AuthenticationService);
    result = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'ifong',
    });
    //sign up to create actual account
    await authService.signupByEmail(result.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567',
    });
    user = await userService.getUserFromCredential(result.credentialDocument);
    const followerResult = await authService.createAccount({
      deviceUUID: 'followerAbcde',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'ifong',
    });
    await authService.signupByEmail(followerResult.accountDocument, {
      displayId: 'followerNa',
      displayName: 'followerNa002',
      email: 'sompop2.kulapalanont@gmail.com',
      password: '2@Test12345678',
    });
    //let follower follow user
    follower = await userService.getUserFromCredential(
      followerResult.credentialDocument,
    );
    await userService.follow(follower, user);
    followerAccount = await authService.getAccountFromEmail(
      'sompop2.kulapalanont@gmail.com',
    );
    console.debug(followerAccount);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('#getAndcreateFeedItemByCreateTime()', () => {
    const shortPayload: ShortPayload = {
      message: 'this is test status',
    };
    const shortPayload2: ShortPayload = {
      message: 'this is test status2',
    };
    const shortPayload3: ShortPayload = {
      message: 'this is test status3',
    };
    const shortPayload4: ShortPayload = {
      message: 'this is test status4',
    };
    const shortPayload5: ShortPayload = {
      message: 'this is test status5',
    };
    beforeAll(async () => {
      contents[0] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload,
        castcleId: user.displayId,
      });
      contents[1] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2,
        castcleId: user.displayId,
      });
      contents[2] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload3,
        castcleId: user.displayId,
      });
      contents[3] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload4,
        castcleId: user.displayId,
      });
      contents[4] = await contentService.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload5,
        castcleId: user.displayId,
      });
      const contentIds = contents.map((item) => item.id);
      console.log('contentIds', contentIds);
      await service._defaultContentModel.insertMany(
        contentIds.map((id, index) => ({
          content: id,
          index: index,
        })),
      );
    });
    it('should create feedItem after create a content', async () => {
      const totalFeedItem = await service._feedItemModel.countDocuments();
      expect(totalFeedItem).toEqual(0);
      const feedItems = await service._feedItemModel.find().exec();
      expect(feedItems.length).toEqual(0);
    });
  });

  describe('getGuestFeedItems', () => {
    it('should return prefix from defaultContents collections', async () => {
      const guestFeeds = await service.getGuestFeedItems(
        {
          maxResults: 5,
          hasRelationshipExpansion: false,
        },
        result.accountDocument,
      );

      expect(guestFeeds.payload).toHaveLength(5);
      expect(guestFeeds.payload[0].payload['message']).toEqual(
        'this is test status',
      );
      expect(guestFeeds.payload[1].payload['message']).toEqual(
        'this is test status2',
      );
      expect(guestFeeds.payload[2].payload['message']).toEqual(
        'this is test status3',
      );
      expect(guestFeeds.payload[3].payload['message']).toEqual(
        'this is test status4',
      );
      expect(guestFeeds.payload[4].payload['message']).toEqual(
        'this is test status5',
      );
    });
  });
});
