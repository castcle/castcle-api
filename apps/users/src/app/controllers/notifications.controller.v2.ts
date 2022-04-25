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
  NotificationQuery,
  NotificationSourceQuery,
} from '@castcle-api/database/dtos';
import { CastcleException } from '@castcle-api/utils/exception';
import { Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  createCastcleMeta,
  NotificationServiceV2,
} from '@castcle-api/database';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { CacheKeyName } from '@castcle-api/environments';

@CastcleControllerV2({ path: 'notifications' })
export class NotificationsControllerV2 {
  constructor(private notificationServiceV2: NotificationServiceV2) {}

  async _getNotificationIfExist(id: string) {
    const notification = await this.notificationServiceV2.getFromId(id);
    if (!notification) throw CastcleException.NOTIFICATION_NOT_FOUND;
    return notification;
  }

  @CastcleAuth(CacheKeyName.NotificationsGet)
  @Get()
  async getAllNotify(
    @Auth() authorizer: Authorizer,
    @Query() query?: NotificationQuery
  ) {
    authorizer.requestAccessForAccount(authorizer.account._id);

    const notifications = await this.notificationServiceV2.getAllNotify(
      authorizer.account,
      query
    );
    return {
      payload: await this.notificationServiceV2.generateMessagesToNotifications(
        notifications,
        authorizer.account.preferences.languages[0]
      ),
      meta: createCastcleMeta(notifications),
    };
  }

  @CastcleBasicAuth()
  @Post(':id/reads')
  @HttpCode(204)
  async readNotify(@Auth() authorizer: Authorizer, @Param('id') id: string) {
    authorizer.requestAccessForAccount(authorizer.account._id);

    const notification = await this._getNotificationIfExist(id);
    await this.notificationServiceV2.readNotify(notification);
  }
  @CastcleBasicAuth()
  @Post('reads')
  @HttpCode(204)
  async readAllNotify(@Auth() authorizer: Authorizer) {
    authorizer.requestAccessForAccount(authorizer.account._id);

    await this.notificationServiceV2.readAllNotify(authorizer.account);
  }

  @CastcleBasicAuth()
  @Delete(':id')
  @HttpCode(204)
  async deleteNotify(@Auth() authorizer: Authorizer, @Param('id') id: string) {
    authorizer.requestAccessForAccount(authorizer.account._id);

    const notification = await this._getNotificationIfExist(id);
    await this.notificationServiceV2.deleteNotify(notification);
  }

  @CastcleBasicAuth()
  @Delete()
  @HttpCode(204)
  async deleteAllSourceNotify(
    @Auth() authorizer: Authorizer,
    @Query() { source }: NotificationSourceQuery
  ) {
    authorizer.requestAccessForAccount(authorizer.account._id);

    await this.notificationServiceV2.deleteAllSourceNotify(source);
  }

  @CastcleAuth(CacheKeyName.NotificationsBadges)
  @Get('badges')
  async badgesNotify(@Auth() authorizer: Authorizer) {
    authorizer.requestAccessForAccount(authorizer.account._id);

    const badgeNotify = await this.notificationServiceV2.getBadges(
      authorizer.account
    );
    return badgeNotify;
  }
}
