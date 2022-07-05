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
  Meta,
  NotificationQuery,
  NotificationServiceV2,
  NotificationSourceQuery,
  ResponseDto,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import {
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

@CastcleControllerV2({ path: 'notifications' })
export class NotificationsControllerV2 {
  constructor(private notificationService: NotificationServiceV2) {}

  @CastcleAuth(CacheKeyName.NotificationsGet)
  @Get()
  async getAllNotify(
    @Auth() authorizer: Authorizer,
    @Query() query: NotificationQuery,
  ) {
    const notifications = await this.notificationService.getAllNotify(
      authorizer.account,
      query,
    );
    const payloadNotify =
      await this.notificationService.generateNotificationsResponse(
        notifications,
        authorizer.account.preferences.languages[0],
      );
    return ResponseDto.ok({
      payload: payloadNotify,
      meta: Meta.fromDocuments(payloadNotify),
    });
  }

  @CastcleBasicAuth()
  @Post(':id/reads')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readNotify(@Param('id') id: string) {
    await this.notificationService.readNotify(id);
  }
  @CastcleBasicAuth()
  @Post('reads')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readAllSourceNotify(
    @Auth() authorizer: Authorizer,
    @Query() { source }: NotificationSourceQuery,
  ) {
    await this.notificationService.readAllSourceNotify(
      authorizer.account,
      source,
    );
  }

  @CastcleBasicAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotify(@Param('id') id: string) {
    await this.notificationService.deleteNotify(id);
  }

  @CastcleBasicAuth()
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAllSourceNotify(
    @Auth() authorizer: Authorizer,
    @Query() { source }: NotificationSourceQuery,
  ) {
    await this.notificationService.deleteAllSourceNotify(
      authorizer.account,
      source,
    );
  }

  @CastcleAuth(CacheKeyName.NotificationsBadges)
  @Get('badges')
  badgesNotify(@Auth() authorizer: Authorizer) {
    return this.notificationService.getBadges(authorizer.account);
  }
}
