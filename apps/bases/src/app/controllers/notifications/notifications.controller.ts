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
  AuthenticationService,
  NotificationService
} from '@castcle-api/database';
import {
  DEFAULT_NOTIFICATION_QUERY_OPTIONS,
  NotificationResponse,
  NotificationSource
} from '@castcle-api/database/dtos';
import { Configs } from '@castcle-api/environments';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  CredentialInterceptor,
  CredentialRequest,
  HttpCacheIndividualInterceptor
} from '@castcle-api/utils/interceptors';
import {
  LimitPipe,
  NotificationSourcePipe,
  PagePipe,
  SortByEnum,
  SortByPipe
} from '@castcle-api/utils/pipes';
import {
  CacheKey,
  Controller,
  Get,
  Query,
  Req,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiQuery
} from '@nestjs/swagger';
@ApiHeader({
  name: Configs.RequiredHeaders.AcceptLanguague.name,
  description: Configs.RequiredHeaders.AcceptLanguague.description,
  example: Configs.RequiredHeaders.AcceptLanguague.example,
  required: true
})
@ApiHeader({
  name: Configs.RequiredHeaders.AcceptVersion.name,
  description: Configs.RequiredHeaders.AcceptVersion.description,
  example: Configs.RequiredHeaders.AcceptVersion.example,
  required: true
})
@Controller({
  version: '1.0'
})
@Controller()
export class NotificationsController {
  constructor(
    private notificationService: NotificationService,
    private authService: AuthenticationService
  ) {}
  private readonly logger = new CastLogger(
    NotificationsController.name,
    CastLoggerOptions
  );

  @ApiBearerAuth()
  @ApiOkResponse({
    type: NotificationResponse
  })
  @UseInterceptors(HttpCacheIndividualInterceptor)
  @CacheKey(CacheKeyName.NotificationsGet)
  @UseInterceptors(CredentialInterceptor)
  @ApiQuery({
    name: 'sortBy',
    enum: SortByEnum,
    required: false
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false
  })
  @ApiQuery({
    name: 'source',
    enum: NotificationSource,
    required: false
  })
  @Get('notifications')
  async getAll(
    @Req() req: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption: {
      field: string;
      type: 'desc' | 'asc';
    } = DEFAULT_NOTIFICATION_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    pageOption: number = DEFAULT_NOTIFICATION_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_NOTIFICATION_QUERY_OPTIONS.limit,
    @Query('source', NotificationSourcePipe)
    notificationSourceOption: NotificationSource = NotificationSource.Profile
  ): Promise<NotificationResponse> {
    this.logger.log('Start get all notification');
    const notification = await this.notificationService.getAll(
      req.$credential,
      {
        sortBy: sortByOption,
        limit: limitOption,
        page: pageOption,
        source: notificationSourceOption
      }
    );
    return {
      payload: notification.items.map((noti) => noti.toNotificationPayload()),
      pagination: notification.pagination
    };
  }
}
