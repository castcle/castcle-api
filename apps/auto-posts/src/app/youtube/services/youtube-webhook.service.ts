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
  LinkType,
  SaveContentDto,
  ShortPayload,
  SocialProvider,
  SocialSyncService,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { COMMON_SIZE_CONFIGS, Downloader, Image } from '@castcle-api/utils/aws';
import { Injectable } from '@nestjs/common';
import { PublishedContent, SubscriptionContent, Youtube } from '../models';

@Injectable()
export class YoutubeWebhookService {
  private readonly logger = new CastLogger(YoutubeWebhookService.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly downloader: Downloader,
    private readonly socialSyncService: SocialSyncService,
  ) {}

  validateWebhook(dto: {
    challenge: string;
    verifyToken: string;
    topic: string;
    ip: string;
    userAgent: string;
  }) {
    const isValidToken = dto.verifyToken === Environment.YOUTUBE_VERIFY_TOKEN;
    const isYoutubeFeedTopic = Youtube.FEED_URL_PATTERN.test(dto.topic);

    this.logger.log(
      JSON.stringify({
        isValidToken,
        isYoutubeFeedTopic,
        topic: dto.topic,
        ip: dto.ip,
        userAgent: dto.userAgent,
      }),
      'validateWebhook',
    );

    if (!isValidToken) return;
    if (!isYoutubeFeedTopic) return;

    return dto.challenge;
  }

  async createContentFromYoutubeFeed(subscriptionContent: SubscriptionContent) {
    const isPublishedContent = Boolean(subscriptionContent.feed?.entry?.id);
    if (!isPublishedContent) return;

    const feed: PublishedContent = subscriptionContent.feed;
    const channelId = feed.entry['yt:channelId'];
    const syncAccount =
      await this.socialSyncService.getAutoSyncAccountBySocialId(
        SocialProvider.Youtube,
        channelId,
      );

    if (!syncAccount) return;
    if (syncAccount.latestSyncDate > feed.entry.published) return;

    this.logger.log(
      `New youtube feed from: ${feed.entry.author.name}, Video Title: ${feed.entry.title}`,
    );

    const [author, shortContent] = await Promise.all([
      this.contentService.getAuthorFromId(syncAccount.user),
      await this.convertFeedToShortContent(feed, syncAccount.user.toString()),
    ]);

    await this.contentService.createContentsFromAuthor(new Author(author), [
      shortContent,
    ]);

    syncAccount.displayName = feed.entry.author.name;
    syncAccount.latestSyncId = feed.entry.id;
    syncAccount.latestSyncDate = feed.entry.published;
    await syncAccount.save();

    this.logger.log('Done, waiting for next available feed');
  }

  private async convertFeedToShortContent(
    feed: PublishedContent,
    authenticationId: string,
  ) {
    const thumbnailUrl = await this.getThumbnailUrlFromVideoId(
      authenticationId,
      feed.entry['yt:videoId'],
    );

    const linkPreview = {
      image: thumbnailUrl,
      type: LinkType.Youtube,
      url: feed.entry.link,
    };

    const payload = {
      message: feed.entry.title,
      link: [linkPreview],
    } as ShortPayload;

    return { payload, type: ContentType.Short } as SaveContentDto;
  }

  private async getThumbnailUrlFromVideoId(authorId: string, videoId: string) {
    const youtubeThumbnailUrl = Youtube.thumbnailUrlFromId(videoId);
    const image = await this.downloader.getImageFromUrl(youtubeThumbnailUrl);
    const uploaded = await Image.upload(image, {
      filename: `youtube-${videoId}`,
      sizes: COMMON_SIZE_CONFIGS,
      subpath: `contents/${authorId}`,
    });

    return uploaded.image;
  }
}
