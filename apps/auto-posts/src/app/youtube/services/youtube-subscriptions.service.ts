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

import { SocialProvider, SocialSyncService } from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { Youtube } from '../models';

@Injectable()
export class YoutubeSubscriptionsService {
  private readonly HUB_URL = 'http://pubsubhubbub.appspot.com';
  private readonly logger = new CastLogger(YoutubeSubscriptionsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly socialSyncService: SocialSyncService
  ) {}

  async renewWebhookSubscription(socialId: string) {
    try {
      this.logger.log(
        `Renewing webhook subscription of Youtube ID: ${socialId}`
      );

      await firstValueFrom(
        this.httpService.post(`${this.HUB_URL}/subscribe`, null, {
          params: {
            'hub.mode': 'subscribe',
            'hub.topic': encodeURI(Youtube.feedUrlFromId(socialId)),
            'hub.verify_token': encodeURI(Environment.YOUTUBE_VERIFY_TOKEN),
            'hub.callback': encodeURI(Environment.YOUTUBE_WEBHOOK_CALLBACK),
          },
        })
      );

      this.logger.log(
        `Webhook subscription of Youtube ID: ${socialId} has successfully renewed`
      );
    } catch (error) {
      this.logger.log(
        `Cannot renew webhook subscription of Youtube ID: ${socialId} due to error: ${JSON.stringify(
          error,
          null,
          2
        )}`
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async renewWebhookSubscriptions() {
    const syncAccounts = await this.socialSyncService.getAutoSyncAccounts(
      SocialProvider.Youtube
    );

    syncAccounts.forEach(async (syncAccount) => {
      await this.renewWebhookSubscription(syncAccount.socialId);
    });
  }
}
