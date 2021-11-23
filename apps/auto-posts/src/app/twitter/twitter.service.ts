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
import TwitterApi, { TwitterApiv2 } from 'twitter-api-v2';
import { Environment } from '@castcle-api/environments';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthenticationService, ContentService } from '@castcle-api/database';
import {
  AccountAuthenIdDocument,
  AccountAuthenIdType
} from '@castcle-api/database/schemas';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';

@Injectable()
export class TwitterService {
  private readonly client: TwitterApiv2;
  private readonly logger = new CastLogger(
    TwitterService.name,
    CastLoggerOptions
  );

  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly contentService: ContentService
  ) {
    this.client = new TwitterApi(Environment.TWITTER_BEARER_TOKEN).v2;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleTwitterJobs() {
    this.logger.log(`Start looking for user's timeline`);

    const accounts = await this.authenticationService.getAutoPostAccounts(
      AccountAuthenIdType.Twitter
    );

    await Promise.all(accounts.map(this.toSaveContents));
    this.logger.log('Done, waiting for next available schedule');
  }

  toSaveContents = async (accountAuthenId: AccountAuthenIdDocument) => {
    const tweets = await this.getTweetsByUserId(
      accountAuthenId.socialId,
      accountAuthenId.latestPostId
    );

    this.logger.log(
      `Name: ${accountAuthenId.displayName}, tweet(s): ${tweets.meta.result_count}`
    );

    if (!tweets.meta.result_count) return;

    const user = await this.authenticationService.getUserFromAccount(
      accountAuthenId.account
    );

    await this.contentService.createContentsFromTweets(user, tweets);
    accountAuthenId.displayName = tweets.includes?.users?.[0]?.name;
    accountAuthenId.latestPostId = tweets.data.data[0].id;
    await accountAuthenId.save();

    this.logger.log(
      `Name: ${accountAuthenId.displayName}, ${tweets.meta.result_count} tweet(s) saved`
    );
  };

  getTweetsByUserId = (userId: string, latestPostId: string) => {
    return this.client.userTimeline(userId, {
      exclude: ['retweets', 'replies'],
      expansions: ['attachments.media_keys', 'author_id'],
      'media.fields': ['media_key', 'type', 'url'],
      since_id: latestPostId
    });
  };
}
