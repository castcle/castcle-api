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
  Author,
  ContentService,
  ContentType,
  Link,
  LinkType,
  SaveContentDto,
  SocialProvider,
  SocialSync,
  SocialSyncService,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { COMMON_SIZE_CONFIGS, Downloader, Image } from '@castcle-api/utils/aws';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import TwitterApi, { Tweetv2TimelineResult } from 'twitter-api-v2';

@Injectable()
export class TwitterService {
  private readonly client = new TwitterApi(Environment.TWITTER_BEARER_TOKEN).v2;
  private readonly logger = new CastLogger(TwitterService.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly downloader: Downloader,
    private readonly socialSyncService: SocialSyncService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleTwitterJobs() {
    this.logger.log(
      `Start looking for user's timeline`,
      'handleTwitterJobs:init',
    );

    const syncAccounts = await this.socialSyncService.getAutoSyncAccounts(
      SocialProvider.Twitter,
    );

    this.logger.log(JSON.stringify(syncAccounts), 'handleTwitterJobs:start');

    for (const syncAccount of syncAccounts) {
      await this.syncTwittersTweets(syncAccount);
    }

    this.logger.log(
      'Waiting for next available schedule',
      'handleTwitterJobs:done',
    );
  }

  syncTwittersTweets = async (syncAccount: SocialSync) => {
    try {
      const timeline = await this.getTimelineByUserId(
        syncAccount.socialId,
        syncAccount.latestSyncId,
      );

      if (!timeline?.meta?.result_count) return;

      const [author, contents] = await Promise.all([
        this.contentService.getAuthorFromId(syncAccount.user),
        this.convertTimelineToContents(
          syncAccount.user.toString(),
          timeline.data,
        ),
      ]);

      await this.contentService.createContentsFromAuthor(
        new Author(author),
        contents,
      );

      syncAccount.displayName = timeline.includes?.users?.[0]?.name;
      syncAccount.latestSyncId = timeline.data.data[0].id;
      syncAccount.latestSyncDate = new Date();
      await syncAccount.save();

      this.logger.log(
        `Name: ${syncAccount.displayName}, ${timeline.meta.result_count} tweet(s) saved`,
        `${syncAccount.socialId}:syncTweetsByAccount`,
      );
    } catch (error: unknown) {
      this.logger.error(error, `${syncAccount.socialId}:syncTweetsByAccount`);
    }
  };

  getTimelineByUserId = async (userId: string, latestPostId: string) => {
    try {
      const timeline = await this.client.userTimeline(userId, {
        exclude: ['retweets', 'replies'],
        expansions: ['attachments.media_keys', 'author_id'],
        'media.fields': ['media_key', 'preview_image_url', 'type', 'url'],
        since_id: latestPostId,
        'tweet.fields': ['referenced_tweets'],
      });

      if (timeline.data.errors?.length) throw timeline.data.errors;

      this.logger.log(
        JSON.stringify({
          userId,
          latestPostId,
          tweetsCount: timeline.meta.result_count,
        }),
        `${userId}:getTimelineByUserId`,
      );

      return timeline;
    } catch (error: unknown) {
      this.logger.error(error, `${userId}:getTimelineByUserId`);
    }
  };

  convertTimelineToContents(userId: string, timeline: Tweetv2TimelineResult) {
    const $contents = timeline.data
      .filter(({ referenced_tweets }) => {
        return !referenced_tweets?.some(({ type }) => type === 'quoted');
      })
      .map(async ({ attachments, entities, id, text }) => {
        const $images = attachments?.media_keys?.map(async (mediaKey) => {
          const medium = timeline.includes?.media?.find(
            ({ media_key: key }) => key === mediaKey,
          );

          const imageUrl = medium?.url || medium?.preview_image_url;

          if (!imageUrl) return;

          const image = await this.downloader.getImageFromUrl(imageUrl);
          const uploaded = await Image.upload(image, {
            filename: `twitter-${medium.media_key}`,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `contents/${userId}`,
          });

          return uploaded.image;
        });

        const images = await Promise.all(($images ?? []).filter(Boolean));
        const link: Link[] = [];

        entities?.urls?.forEach(
          ({ expanded_url, images, title, description, url }) => {
            const isTwitterReferenceLink = expanded_url.includes(id);
            text = text.replace(
              url,
              isTwitterReferenceLink ? '' : expanded_url,
            );

            if (!isTwitterReferenceLink) {
              link.push({
                type: LinkType.Other,
                url,
                imagePreview: images?.[0]?.url,
                title,
                description,
              });
            }
          },
        );

        return {
          payload: {
            message: text.trim(),
            photo: images.length ? { contents: images } : undefined,
            link,
          },
          type: ContentType.Short,
        } as SaveContentDto;
      });

    return Promise.all($contents);
  }
}
