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
import { CastcleMongooseModule } from '@castcle-api/environments';
import { TestingModule } from '@castcle-api/testing';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { ShortPayload } from '../dtos';
import { ContentType, QueueName } from '../models';
import { Repository } from '../repositories';
import { Account, Content, User } from '../schemas';
import { ContentService } from './content.service';
import { DataService } from './data.service';
import { HashtagService } from './hashtag.service';
import { RankerService } from './ranker.service';

describe('Ranker Service', () => {
  let moduleRef: TestingModule;
  let service: RankerService;
  let contentService: ContentService;
  let account: Account;
  let user: User;
  let follower: User;
  const contents: Content[] = [];

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CacheModule.register(),
        CastcleMongooseModule,
        HttpModule,
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        ContentService,
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
    });

    service = moduleRef.get(RankerService);
    contentService = moduleRef.get(ContentService);
    const [user1, user2] = await moduleRef.createUsers(2);
    account = user1.account;
    user = user1.user;
    follower = user2.user;
    await follower.follow(user);
  });

  afterAll(() => {
    return moduleRef.close();
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
        account,
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
