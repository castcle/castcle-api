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
  NotificationBadgesResponse,
  NotificationQuery,
  NotificationResponse,
  NotificationService,
  NotificationSource,
  RegisterTokenDto,
  UserService,
  createCastcleMeta,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  CastcleAuth,
  CastcleBasicAuth,
  CastcleController,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { NotificationSourcePipe } from '@castcle-api/utils/pipes';
import {
  Body,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';

@CastcleController({ path: 'notifications', version: '1.0' })
export class NotificationsController {
  #logger = new CastLogger(NotificationsController.name);

  constructor(
    private notificationService: NotificationService,
    private userService: UserService,
  ) {}

  async _getNotificationIfExist(id: string) {
    const notification = await this.notificationService.getFromId(id);
    if (!notification) throw new CastcleException('NOTIFICATION_NOT_FOUND');
    return notification;
  }

  @ApiOkResponse({
    type: NotificationResponse,
  })
  @CastcleAuth(CacheKeyName.NotificationsGet)
  @ApiQuery({
    name: 'maxResults',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'sinceId',
    type: String,
    required: false,
  })
  @ApiQuery({
    name: 'untilId',
    type: String,
    required: false,
  })
  @ApiQuery({
    name: 'source',
    enum: NotificationSource,
    required: false,
  })
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @Get()
  async getAll(
    @Req() req: CredentialRequest,
    @Query() query?: NotificationQuery,
    @Query('source', NotificationSourcePipe)
    sourceOption?: NotificationSource,
  ) {
    if (query?.maxResults) {
      if (+query.maxResults < 5 || +query.maxResults > 100) {
        throw new CastcleException('INVALID_MAX_RESULT');
      }
    }
    const notifications = await this.notificationService.getNotificationAll(
      req.$credential,
      {
        ...query,
        ...{ source: sourceOption },
      },
    );

    const responseNotifications =
      await this.notificationService.generateMessagesToNotifications(
        notifications,
        req.$language,
      );
    return {
      payload: responseNotifications,
      meta: createCastcleMeta(notifications),
    };
  }

  @ApiResponse({
    status: 204,
  })
  @CastcleBasicAuth()
  @Put(':id/read')
  @HttpCode(204)
  async notificationRead(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (!user) {
      throw new CastcleException('FORBIDDEN');
    }
    const notification = await this._getNotificationIfExist(id);

    await this.notificationService.flagRead(notification);
  }

  @ApiResponse({
    status: 204,
  })
  @CastcleBasicAuth()
  @Put('readAll')
  @HttpCode(204)
  async notificationReadAll(@Req() req: CredentialRequest) {
    this.#logger.log('Notification mark read all.');
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (!user) {
      throw new CastcleException('FORBIDDEN');
    }
    await this.notificationService.flagReadAll(req.$credential);
    this.#logger.log('Success mark read all notification');
    return '';
  }

  @ApiBody({
    type: RegisterTokenDto,
  })
  @ApiResponse({
    status: 204,
  })
  @CastcleBasicAuth()
  @Post('registerToken')
  async registerToken(
    @Req() req: CredentialRequest,
    @Body() body: RegisterTokenDto,
  ) {
    this.#logger.log(
      'Notification register token. uuid:',
      JSON.stringify(body.deviceUUID),
    );
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (!user) throw new CastcleException('FORBIDDEN');

    await this.notificationService.registerToken(body);
  }
  @ApiOkResponse({
    type: NotificationBadgesResponse,
  })
  @CastcleAuth(CacheKeyName.NotificationsBadges)
  @Get('badges')
  async badges(@Req() req: CredentialRequest) {
    const badgeNotify = await this.notificationService.getBadges(
      req.$credential,
    );
    return {
      payload: {
        badges: badgeNotify,
      },
    };
  }
}
