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
import { YoutubeWebhookService } from './youtube-webhook.service';
import { Downloader, Image } from '@castcle-api/utils/aws';
import { PublishedContent, SubscriptionContent } from '../models';
import { CastLogger } from '@castcle-api/logger';
import { XMLParser } from 'fast-xml-parser';

jest.mock('@castcle-api/utils/aws');

type Extend<T, R> = Pick<T, Exclude<keyof T, keyof R>> & R;

describe('Youtube Webhook Service', () => {
  let contentService: ContentService;
  let socialSyncService: SocialSyncService;
  let youtubeService: Extend<
    YoutubeWebhookService,
    { parser: XMLParser; logger: CastLogger }
  >;

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

  const feed = {
    entry: { 'yt:channelId': '1234567890', author: { name: 'KT' } },
  } as PublishedContent;

  const subscriptionContent = {
    feed,
    isPublishedContent: true,
  } as SubscriptionContent;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeWebhookService,
        {
          provide: ContentService,
          useValue: {
            createContentsFromAuthor: jest.fn(),
            getAuthorFromId: jest.fn(),
          },
        },
        {
          provide: Downloader,
          useValue: {
            getImageFromUrl: jest.fn(),
          },
        },
        {
          provide: SocialSyncService,
          useValue: {
            getAutoSyncAccountBySocialId: jest.fn(),
          },
        },
      ],
    }).compile();

    contentService = module.get(ContentService);
    socialSyncService = module.get(SocialSyncService);
    youtubeService = module.get(YoutubeWebhookService);
    youtubeService.logger = { log: jest.fn() } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('#getSubscriptionContentFromRequest', () => {
    class MockRequest {
      callback: Record<string, any> = {};
      raw = `<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
<link rel="hub" href="https://pubsubhubbub.appspot.com"/>
<link rel="self" href="https://www.youtube.com/xml/feeds/videos.xml?channel_id=CHANNEL_ID"/>
<title>YouTube video feed</title>
<updated>2015-04-01T19:05:24.552394234+00:00</updated>
<entry>
 <id>yt:video:VIDEO_ID</id>
 <yt:videoId>VIDEO_ID</yt:videoId>
 <yt:channelId>CHANNEL_ID</yt:channelId>
 <title>Video title</title>
 <link rel="alternate" href="http://www.youtube.com/watch?v=VIDEO_ID"/>
 <author>
  <name>Channel title</name>
  <uri>http://www.youtube.com/channel/CHANNEL_ID</uri>
 </author>
 <published>2015-03-06T21:40:57+00:00</published>
 <updated>2015-03-09T19:05:24.552394234+00:00</updated>
</entry>
</feed>`;

      on = (event: string, callback: any) => {
        this.callback[event] = callback;
      };

      emit = (event: string, arg?: any) => {
        this.callback[event](arg);
      };
    }

    it('should return data if there is no error', async () => {
      const request = new MockRequest();
      const context = youtubeService.getSubscriptionContentFromRequest(
        request as any
      );

      request.emit('data', request.raw);
      request.emit('end');

      const data = await context;
      const feed = data.feed as PublishedContent;

      expect(data.isPublishedContent).toBeTruthy();
      expect(feed.entry['yt:channelId']).toEqual('CHANNEL_ID');
      expect(feed.entry.author.name).toEqual('Channel title');
    });
  });

  describe('#createContentFromYoutubeFeed', () => {
    it('should abort process if subscription content is instance of deleted content', async () => {
      const deletedContent = {
        isPublishedContent: false,
      } as SubscriptionContent;

      await youtubeService.createContentFromYoutubeFeed(deletedContent);

      expect(youtubeService.logger.log).not.toBeCalled();
    });

    it('should log activities and create content from feed', async () => {
      jest
        .spyOn(Image, 'upload')
        .mockResolvedValue({ toSignUrl: () => 'media.url' } as any);

      jest
        .spyOn(socialSyncService, 'getAutoSyncAccountBySocialId')
        .mockResolvedValueOnce(syncAccount);

      jest
        .spyOn(contentService, 'getAuthorFromId')
        .mockResolvedValueOnce(syncAccount.author);

      jest
        .spyOn(contentService, 'createContentsFromAuthor')
        .mockResolvedValueOnce({} as any);

      await youtubeService.createContentFromYoutubeFeed(subscriptionContent);

      expect(youtubeService.logger.log).toBeCalledTimes(2);
      expect(syncAccount.save).toBeCalledTimes(1);
    });
  });
});
