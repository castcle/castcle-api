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
import { YoutubeService } from './youtube.service';
import { Downloader, Image } from '@castcle-api/utils/aws';
import { PublishedContent, SubscriptionContent } from './models';
import { CastLogger } from '@castcle-api/logger';
import { XMLParser } from 'fast-xml-parser';

jest.mock('@castcle-api/utils/aws');
jest.mock('fast-xml-parser');

type Extend<T, R> = Pick<T, Exclude<keyof T, keyof R>> & R;

describe('Twitter Service', () => {
  let contentService: ContentService;
  let socialSyncService: SocialSyncService;
  let youtubeService: Extend<
    YoutubeService,
    { parser: XMLParser; logger: CastLogger }
  >;

  const author = {
    id: '1234567890',
    type: 'page',
    castcleId: 'castcleId',
    displayName: 'Castcle'
  };

  const syncAccount = {
    active: true,
    author,
    socialId: '1234567890',
    save: jest.fn()
  } as any;

  const feed = {
    entry: { 'yt:channelId': '1234567890', author: { name: 'KT' } }
  } as PublishedContent;

  const subscriptionContent = {
    feed,
    isPublishedContent: true
  } as SubscriptionContent;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeService,
        {
          provide: ContentService,
          useValue: {
            createContentsFromAuthor: jest.fn()
          }
        },
        {
          provide: Downloader,
          useValue: {
            getImageFromUrl: jest.fn()
          }
        },
        {
          provide: SocialSyncService,
          useValue: {
            getAutoSyncAccountBySocialId: jest.fn()
          }
        }
      ]
    }).compile();

    contentService = module.get(ContentService);
    socialSyncService = module.get(SocialSyncService);
    youtubeService = module.get(YoutubeService);
    youtubeService.logger = { log: jest.fn() } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('#createContentFromYoutubeFeed', () => {
    it('should abort process if subscription content is instance of deleted content', async () => {
      const deletedContent = {
        isPublishedContent: false
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
        .spyOn(contentService, 'createContentsFromAuthor')
        .mockResolvedValueOnce({} as any);

      await youtubeService.createContentFromYoutubeFeed(subscriptionContent);

      expect(youtubeService.logger.log).toBeCalledTimes(2);
      expect(syncAccount.save).toBeCalledTimes(1);
    });
  });
});
