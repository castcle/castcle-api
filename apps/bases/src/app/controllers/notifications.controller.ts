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
import { NotificationService, UserService } from '@castcle-api/database';
import {
  NotificationBadgesResponse,
  NotificationResponse,
  NotificationSource,
  RegisterTokenDto,
} from '@castcle-api/database/dtos';
import { CastLogger } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  CastcleAuth,
  CastcleBasicAuth,
  CastcleController,
} from '@castcle-api/utils/decorators';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
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
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';

@CastcleController('1.0')
export class NotificationsController {
  private logger = new CastLogger(NotificationsController.name);

  constructor(
    private notificationService: NotificationService,
    private userService: UserService
  ) {}

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
  @Get('notifications')
  async getAll(
    @Req() req: CredentialRequest,
    @Query('maxResults') maxResults?: number,
    @Query('sinceId') sinceId?: string,
    @Query('untilId') untilId?: string,
    @Query('source', NotificationSourcePipe)
    notificationSourceOption?: NotificationSource
  ): Promise<NotificationResponse> {
    this.logger.log('Start get all notification');
    if (maxResults) {
      this.logger.log('validate min & max maxResults');
      if (+maxResults < 5 || +maxResults > 100) {
        throw new CastcleException(
          CastcleStatus.INVALID_MAX_RESULT,
          req.$language
        );
      }
    }
    this.logger.log('Get all notification');
    const notification = await this.notificationService.getAll(
      req.$credential,
      {
        maxResults: maxResults,
        sinceId: sinceId,
        untilId: untilId,
        source: notificationSourceOption,
      }
    );
    this.logger.log('Success get all notification');
    return {
      payload: notification.items.map((noti) => noti.toNotificationPayload()),
      meta: notification.meta,
    };
  }

  async _getNotificationIfExist(id: string, req: CredentialRequest) {
    const notification = await this.notificationService.getFromId(id);
    if (notification) return notification;
    else
      throw new CastcleException(
        CastcleStatus.NOTIFICATION_NOT_FOUND,
        req.$language
      );
  }

  @ApiResponse({
    status: 204,
  })
  @CastcleBasicAuth()
  @Put('notifications/:id/read')
  @HttpCode(204)
  async notificationRead(
    @Param('id') id: string,
    @Req() req: CredentialRequest
  ) {
    this.logger.log('Notification mark read. id:' + id);
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (!user) {
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    }
    const notification = await this._getNotificationIfExist(id, req);
    await this.notificationService.flagRead(notification);
    this.logger.log('Success mark read notification');
    return '';
  }

  @ApiResponse({
    status: 204,
  })
  @CastcleBasicAuth()
  @Put('notifications/readAll')
  @HttpCode(204)
  async notificationReadAll(@Req() req: CredentialRequest) {
    this.logger.log('Notification mark read all.');
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (!user) {
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    }
    await this.notificationService.flagReadAll(req.$credential);
    this.logger.log('Success mark read all notification');
    return '';
  }

  @ApiBody({
    type: RegisterTokenDto,
  })
  @ApiResponse({
    status: 204,
  })
  @CastcleBasicAuth()
  @Post('notifications/registerToken')
  async registerToken(
    @Req() req: CredentialRequest,
    @Body() body: RegisterTokenDto
  ) {
    this.logger.log('Notification register token. uuid:' + body.deviceUUID);
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (!user) {
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    }

    await this.notificationService.registerToken(body);
    this.logger.log('Success register token');
    return '';
  }

  @ApiOkResponse({
    type: NotificationBadgesResponse,
  })
  @CastcleAuth(CacheKeyName.NotificationsBadges)
  @Get('notifications/badges')
  async badges(
    @Req() req: CredentialRequest
  ): Promise<NotificationBadgesResponse> {
    this.logger.log('Start get notification badges');
    const result = await this.notificationService.getBadges(req.$credential);
    this.logger.log('Success get notification badges');
    return {
      payload: {
        badges: result,
      },
    };
  }
}
