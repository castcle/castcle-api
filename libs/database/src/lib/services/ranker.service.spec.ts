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
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { RankerService } from './ranker.service';
import { ContentService } from './content.service';
import { UserService } from './user.service';
import { AuthenticationService } from './authentication.service';
import { Account, Content, Credential, User } from '../schemas';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { ContentType, ShortPayload } from '../dtos';
import { UserProducer } from '@castcle-api/utils/queue';
import { HashtagService } from './hashtag.service';
import { CacheModule } from '@nestjs/common';
import { DataService } from './data.service';
import { getQueueToken } from '@nestjs/bull';
import { QueueName } from '../models';

describe('Ranker Service', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
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
    app = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [
        ContentService,
        UserService,
        AuthenticationService,
        RankerService,
        UserProducer,
        HashtagService,
        { provide: DataService, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = app.get<RankerService>(RankerService);
    contentService = app.get<ContentService>(ContentService);
    userService = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
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
      followerResult.credentialDocument
    );
    await userService.follow(follower, user);
    followerAccount = await authService.getAccountFromEmail(
      'sompop2.kulapalanont@gmail.com'
    );
    console.debug(followerAccount);
  });

  afterAll(async () => {
    await app.close();
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
        }))
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
        result.accountDocument
      );
      expect(guestFeeds.payload[0].id).toEqual('default');
      expect(guestFeeds.payload[1].id).toEqual('default');
      expect(guestFeeds.payload[2].id).toEqual('default');
      expect(guestFeeds.payload[3].id).toEqual('default');
      expect(guestFeeds.payload[4].id).toEqual('default');
    });
  });
  //TODO !!! Have to add test later on
  /*describe('#getMemberFeedItemsFromViewer', () => {
    it('should be able to view normal feed', async() => {

    })
    it('should fill up content from guestFeed if not so much content right now', async() => {

    })
    it('should not be able to view called content', async () =>{

    })
  })*/
});
