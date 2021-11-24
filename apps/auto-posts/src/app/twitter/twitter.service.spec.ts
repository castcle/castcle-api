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
import {
  AuthenticationService,
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures
} from '@castcle-api/database';
import { TwitterService } from './twitter.service';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ReferencedTweetV2,
  TweetUserTimelineV2Paginator
} from 'twitter-api-v2';
import { ContentType } from '@castcle-api/database/dtos';

describe('Twitter Service', () => {
  let mongoMemoryServer: MongoMemoryServer;
  let authenticationService: AuthenticationService;
  let contentService: ContentService;
  let twitterService: TwitterService;

  const accountAuthenIdDocument = {
    save: jest.fn()
  } as any;

  const media = {
    media_key: '3_1461216794228957186',
    type: 'photo',
    url: 'https://example-image.jpg'
  };

  const tweet = {
    attachments: {
      media_keys: ['3_1461216794228957186']
    },
    id: '1461307091956551690',
    text: 'Sign Up Now 👉 https://t.co/tcMAgbWlxI https://t.co/SgZHBvUKUt'
  };

  const referenceTweet = {
    referenced_tweets: [
      { id: '1461307091956551690', type: 'quoted' }
    ] as ReferencedTweetV2[],
    id: '1461307091956551690',
    text: 'Sign Up Now 👉 https://t.co/tcMAgbWlxI https://t.co/SgZHBvUKUt'
  };

  const meta = {
    result_count: 1,
    newest_id: 'string',
    oldest_id: 'string',
    next_token: 'string'
  };

  const timeline = {
    data: [referenceTweet, tweet],
    includes: { media: [media] },
    meta
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseAsyncFeatures,
        MongooseForFeatures,
        MongooseModule.forRootAsync({
          useFactory: async () => {
            mongoMemoryServer = await MongoMemoryServer.create();
            return { uri: mongoMemoryServer.getUri() };
          }
        })
      ],
      providers: [
        AuthenticationService,
        ContentService,
        HashtagService,
        TwitterService
      ]
    }).compile();

    authenticationService = module.get(AuthenticationService);
    contentService = module.get(ContentService);
    twitterService = module.get(TwitterService);
  });

  describe('#handleTwitterJobs', () => {
    it('should log activities', async () => {
      (twitterService as any).logger = { log: jest.fn() };
      await twitterService.handleTwitterJobs();

      expect((twitterService as any).logger.log).toBeCalledTimes(2);
    });
  });

  describe('#getTweetsByAccount', () => {
    it('should abort job if there is no tweet', async () => {
      jest
        .spyOn(authenticationService, 'getUserFromAccount')
        .mockImplementationOnce(jest.fn());

      jest.spyOn(twitterService, 'getTimelineByUserId').mockResolvedValueOnce({
        meta: { result_count: 0 }
      } as TweetUserTimelineV2Paginator);

      await twitterService.getTweetsByAccount(accountAuthenIdDocument);

      expect(authenticationService.getUserFromAccount).toBeCalledTimes(0);
    });

    it('should map user and tweets to contents then save all contents', async () => {
      jest.spyOn(twitterService, 'getTimelineByUserId').mockResolvedValueOnce({
        data: timeline,
        meta: { result_count: meta.result_count }
      } as TweetUserTimelineV2Paginator);

      jest
        .spyOn(authenticationService, 'getUserFromAccount')
        .mockImplementation(jest.fn());

      jest
        .spyOn(contentService, 'createContentsFromUser')
        .mockImplementation(jest.fn());

      await twitterService.getTweetsByAccount(accountAuthenIdDocument);

      expect(accountAuthenIdDocument.save).toBeCalledTimes(1);
    });
  });

  describe('#getTweetsByUserId', () => {
    it('should return user timeline', () => {
      (twitterService as any).client = { userTimeline: jest.fn() };
      twitterService.getTimelineByUserId('userId', '1');

      expect((twitterService as any).client.userTimeline).toBeCalled();
    });
  });

  describe('#convertTimelineToContents', () => {
    it('should filter quoted tweets', () => {
      const contents = twitterService.convertTimelineToContents(timeline);

      expect(contents.length).toEqual(1);
    });

    it('should trim last Twitter URL and convert all tweets to short contents', () => {
      const contents = twitterService.convertTimelineToContents(timeline);
      const expectedText = 'Sign Up Now 👉 https://t.co/tcMAgbWlxI';

      expect(contents.length).toEqual(1);
      expect(contents[0].type).toBe(ContentType.Short);
      expect(contents[0].payload).toMatchObject({ message: expectedText });
    });
  });
});
