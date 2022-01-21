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

import { Injectable } from '@nestjs/common';
import TwitterApi, {
  Tweetv2TimelineResult,
  TwitterApiv2,
} from 'twitter-api-v2';
import { Environment } from '@castcle-api/environments';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ContentService,
  SocialProvider,
  SocialSyncService,
} from '@castcle-api/database';
import { CastLogger } from '@castcle-api/logger';
import { Author, SaveContentDto } from '@castcle-api/database/dtos';
import { COMMON_SIZE_CONFIGS, Downloader, Image } from '@castcle-api/utils/aws';
import { SocialSyncDocument } from '@castcle-api/database/schemas';

@Injectable()
export class TwitterService {
  private readonly client: TwitterApiv2;
  private readonly logger = new CastLogger(TwitterService.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly downloader: Downloader,
    private readonly socialSyncService: SocialSyncService
  ) {
    this.client = new TwitterApi(Environment.TWITTER_BEARER_TOKEN).v2;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleTwitterJobs() {
    this.logger.log(`Start looking for user's timeline`);

    const syncAccounts = await this.socialSyncService.getAutoSyncAccounts(
      SocialProvider.Twitter
    );

    await Promise.all(syncAccounts.map(this.getTweetsByAccount));

    this.logger.log('Done, waiting for next available schedule');
  }

  getTweetsByAccount = async (syncAccount: SocialSyncDocument) => {
    const timeline = await this.getTimelineByUserId(
      syncAccount.socialId,
      syncAccount.latestSyncId
    );

    this.logger.log(
      `Name: ${syncAccount.displayName}, tweet(s): ${timeline.meta.result_count}`
    );

    if (!timeline.meta.result_count) return;

    const [author, contents] = await Promise.all([
      this.contentService.getAuthorFromId(syncAccount.author.id),
      this.convertTimelineToContents(syncAccount.author.id, timeline.data),
    ]);

    await this.contentService.createContentsFromAuthor(
      new Author(author),
      contents
    );

    syncAccount.author = author;
    syncAccount.displayName = timeline.includes?.users?.[0]?.name;
    syncAccount.latestSyncId = timeline.data.data[0].id;
    syncAccount.latestSyncDate = new Date();
    syncAccount.save();

    this.logger.log(
      `Name: ${syncAccount.displayName}, ${timeline.meta.result_count} tweet(s) saved`
    );
  };

  getTimelineByUserId = (userId: string, latestPostId: string) => {
    return this.client.userTimeline(userId, {
      exclude: ['retweets', 'replies'],
      expansions: ['attachments.media_keys', 'author_id'],
      'media.fields': ['media_key', 'preview_image_url', 'type', 'url'],
      since_id: latestPostId,
      'tweet.fields': ['referenced_tweets'],
    });
  };

  async convertTimelineToContents(
    userId: string,
    timeline: Tweetv2TimelineResult
  ) {
    const toUploadMedia = timeline.includes?.media?.map(async (medium) => {
      const imageUrl = medium?.url || medium?.preview_image_url;

      if (!imageUrl) return;

      const image = await this.downloader.getImageFromUrl(imageUrl);
      const uploadedImage = await Image.upload(image, {
        filename: `twitter-${medium.media_key}`,
        sizes: COMMON_SIZE_CONFIGS,
        subpath: `contents/${userId}`,
      });

      medium.url = uploadedImage.toSignUrl();
    });

    if (toUploadMedia) await Promise.all(toUploadMedia);

    return timeline.data
      .filter(({ referenced_tweets }) => {
        return !referenced_tweets?.some(({ type }) => type === 'quoted');
      })
      .map(({ attachments, text }) => {
        const images = attachments?.media_keys?.map((mediaKey) => {
          const medium = timeline.includes?.media?.find(
            ({ media_key: key }) => key === mediaKey
          );

          return { image: medium?.url };
        });

        return {
          payload: {
            message: text,
            photo: images ? { contents: images } : undefined,
          },
          type: 'short',
        } as SaveContentDto;
      });
  }
}
