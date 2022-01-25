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
import { ContentService, SocialSyncService } from '@castcle-api/database';
import { TwitterService } from './twitter.service';
import {
  ReferencedTweetV2,
  TweetUserTimelineV2Paginator,
  TwitterApiv2,
} from 'twitter-api-v2';
import { Downloader, Image } from '@castcle-api/utils/aws';
import { CastLogger } from '@castcle-api/logger';

jest.mock('twitter-api-v2');
jest.mock('@castcle-api/utils/aws');

class PrivateTwitterService {
  client: TwitterApiv2;
  logger: CastLogger;
}

type Union<T, R> = Pick<T, Exclude<keyof T, keyof R>> & R;

describe('Twitter Service', () => {
  let contentService: ContentService;
  let socialSyncService: SocialSyncService;
  let twitterService: Union<TwitterService, PrivateTwitterService>;

  const author = {
    id: '1234567890',
    type: 'page',
    castcleId: 'castcleId',
    displayName: 'Castcle',
  };

  const syncAccount = {
    active: true,
    author,
    socialId: '1234567890',
    save: jest.fn(),
  } as any;

  const media = {
    media_key: '3_1461216794228957186',
    type: 'photo',
    url: 'https://example-image.jpg',
  };

  const tweet = {
    attachments: {
      media_keys: ['3_1461216794228957186'],
    },
    id: '1461307091956551690',
    text: 'Sign Up Now 👉 https://t.co/tcMAgbWlxI https://t.co/SgZHBvUKUt',
  };

  const referenceTweet = {
    referenced_tweets: [
      { id: '1461307091956551690', type: 'quoted' },
    ] as ReferencedTweetV2[],
    id: '1461307091956551690',
    text: 'Sign Up Now 👉 https://t.co/tcMAgbWlxI https://t.co/SgZHBvUKUt',
  };

  const meta = {
    result_count: 1,
    newest_id: 'string',
    oldest_id: 'string',
    next_token: 'string',
  };

  const timeline = {
    data: [referenceTweet, tweet],
    includes: { media: [media] },
    meta,
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwitterService,
        {
          provide: ContentService,
          useValue: {
            createContentsFromAuthor: jest.fn(),
            getAuthorFromId: jest.fn(),
          },
        },
        {
          provide: Downloader,
          useValue: { getImageFromUrl: jest.fn() },
        },
        {
          provide: SocialSyncService,
          useValue: { getAutoSyncAccounts: jest.fn() },
        },
      ],
    }).compile();

    contentService = module.get(ContentService);
    socialSyncService = module.get(SocialSyncService);
    twitterService = module.get(TwitterService);
    twitterService.logger = { log: jest.fn() } as any;
    twitterService.client = { userTimeline: jest.fn() } as any;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('#handleTwitterJobs', () => {
    it('should log activities', async () => {
      jest
        .spyOn(socialSyncService, 'getAutoSyncAccounts')
        .mockResolvedValueOnce([]);

      await twitterService.handleTwitterJobs();

      expect(twitterService.logger.log).toBeCalledTimes(2);
    });
  });

  describe('#getTweetsByAccount', () => {
    it('should abort job if there is no tweet', async () => {
      jest.spyOn(twitterService, 'getTimelineByUserId').mockResolvedValueOnce({
        meta: { result_count: 0 },
      } as TweetUserTimelineV2Paginator);

      jest
        .spyOn(twitterService, 'convertTimelineToContents')
        .mockImplementationOnce(jest.fn());

      await twitterService.getTweetsByAccount(syncAccount);

      expect(twitterService.convertTimelineToContents).not.toBeCalled();
    });

    it('should map author and tweets to contents then save all contents', async () => {
      jest.spyOn(twitterService, 'getTimelineByUserId').mockResolvedValueOnce({
        data: timeline,
        meta: { result_count: meta.result_count },
      } as TweetUserTimelineV2Paginator);

      jest
        .spyOn(twitterService, 'convertTimelineToContents')
        .mockResolvedValueOnce([]);

      jest
        .spyOn(contentService, 'getAuthorFromId')
        .mockResolvedValueOnce(syncAccount.author);

      jest
        .spyOn(contentService, 'createContentsFromAuthor')
        .mockResolvedValueOnce([]);

      await expect(
        twitterService.getTweetsByAccount(syncAccount)
      ).resolves.not.toThrow();
    });
  });

  describe('#getTimelineByUserId', () => {
    it('should return user timeline', async () => {
      jest.spyOn(twitterService.client, 'userTimeline').mockResolvedValueOnce({
        data: timeline,
      } as TweetUserTimelineV2Paginator);

      expect(() =>
        twitterService.getTimelineByUserId('userId', '1')
      ).not.toThrow();
    });
  });

  describe('#convertTimelineToContents', () => {
    beforeEach(() => {
      jest
        .spyOn(Image, 'upload')
        .mockResolvedValue({ toSignUrl: () => media.url } as Image);
    });

    it('should filter quoted tweets', async () => {
      const contents = await twitterService.convertTimelineToContents(
        author.id,
        timeline
      );

      expect(contents.length).toEqual(1);
    });
  });
});
