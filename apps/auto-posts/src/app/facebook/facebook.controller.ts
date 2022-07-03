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
  ContentService,
  ContentType,
  GetLinkPreview,
  Link,
  LinkType,
  SaveContentDto,
  SocialProvider,
  SocialSyncService,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { COMMON_SIZE_CONFIGS, Downloader, Image } from '@castcle-api/utils/aws';
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { isEnum } from 'class-validator';
import { FastifyRequest } from 'fastify';
import { getLinkPreview } from 'link-preview-js';
import { getClientIp } from 'request-ip';
import { ValidateWebhookQuery } from '../youtube/dto';
import {
  FeedEntryChange,
  FeedEntryItem,
  FeedEntryType,
  SubscriptionEntry,
} from './dto';

@Controller('facebook')
export class FacebookController {
  private logger = new CastLogger(FacebookController.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly downloader: Downloader,
    private readonly socialSyncService: SocialSyncService,
  ) {}

  @Get()
  validateWebhook(
    @Query()
    {
      'hub.challenge': challenge,
      'hub.verify_token': verifyToken,
    }: ValidateWebhookQuery,
    @Req() req: FastifyRequest,
  ) {
    const isValidToken = verifyToken === Environment.FACEBOOK_VERIFY_TOKEN;

    this.logger.log(
      JSON.stringify({
        isValidToken,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      }),
      'validateWebhook',
    );

    if (!isValidToken) return;

    return challenge;
  }

  @Post()
  async handleWebhook(
    @Body('entry') entries: SubscriptionEntry<FeedEntryChange>[],
  ) {
    this.logger.log(JSON.stringify(entries), 'handleWebhook:init');

    for (const entry of entries) {
      const socialId = entry.id;
      const syncAccount =
        await this.socialSyncService.getAutoSyncAccountBySocialId(
          SocialProvider.Facebook,
          socialId,
        );

      if (!syncAccount) {
        this.logger.error(
          `facebook-${socialId}`,
          'handleWebhook:sync-account-not-found',
        );
        continue;
      }

      const author = await this.contentService.getAuthorFromId(
        String(syncAccount.user),
      );

      if (!author) {
        this.logger.error(
          `authorId: ${syncAccount.user}`,
          'handleWebhook:author-not-found',
        );
        continue;
      }

      if (!entry.changes?.length) {
        this.logger.error(`author-${author.id}`, 'handleWebhook:no-change');
        continue;
      }

      const contents: SaveContentDto[] = [];

      for (const change of entry.changes) {
        const feed = change.value;
        const message = feed.message;

        if (feed.verb !== FeedEntryType.ADD) {
          this.logger.error(
            `postId: ${feed.post_id}`,
            'handleWebhook:verb-mismatched',
          );
          continue;
        }

        if (!isEnum(feed.item, FeedEntryItem)) {
          this.logger.error(
            `postId: ${feed.post_id}`,
            'handleWebhook:item-mismatched',
          );
          continue;
        }

        if (feed.item === FeedEntryItem.VIDEO) {
          contents.push({
            type: ContentType.Video,
            payload: {
              message,
              link: [
                {
                  type: LinkType.Facebook,
                  url: `https://www.facebook.com/${entry.id}/videos/${feed.video_id}`,
                },
              ],
            },
          } as SaveContentDto);
          continue;
        }

        const getPreviewFromLink = async () => {
          try {
            const link = feed.link.startsWith('/')
              ? `https://www.facebook.com/${feed.link}`
              : feed.link;

            const linkPreview = (await getLinkPreview(link)) as GetLinkPreview;

            return linkPreview.mediaType === 'image'
              ? { photoUrl: linkPreview.url }
              : {
                  link: [
                    {
                      url: linkPreview.url,
                      type: LinkType.Other,
                      title: linkPreview.title,
                      description: linkPreview.description,
                      imagePreview: linkPreview.images?.[0],
                    } as Link,
                  ],
                };
          } catch (error) {
            this.logger.error(error);
            return {};
          }
        };

        const { photoUrl, link } = await getPreviewFromLink();
        const photoUrls = [...(feed.photos || []), photoUrl].filter(Boolean);
        const $photos = photoUrls.map(async (url, index) => {
          const base64Photo = await this.downloader.getImageFromUrl(url);
          const uploaded = await Image.upload(base64Photo, {
            filename: `facebook-${feed.post_id}-${index}`,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `contents/${socialId}`,
          });

          return uploaded.image;
        });

        const photos = await Promise.all($photos);
        const photo = photos.length ? { contents: photos } : undefined;
        const type =
          feed.item === FeedEntryItem.PHOTO && !message
            ? ContentType.Image
            : message?.length > 280
            ? ContentType.Long
            : ContentType.Short;

        contents.push({
          type,
          payload: { message, photo, link },
        } as SaveContentDto);
      }

      if (!contents.length) continue;

      const createdContents =
        await this.contentService.createContentsFromAuthor(author, contents);

      this.logger.log(
        JSON.stringify(createdContents),
        'handleWebhook:contents-created',
      );
    }
  }
}
