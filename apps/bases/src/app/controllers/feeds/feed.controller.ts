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

import { Controller, Get, Query, Req, UseInterceptors } from '@nestjs/common';
import {
  AuthenticationService,
  UserService,
  RankerService
} from '@castcle-api/database';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import {
  CredentialInterceptor,
  CredentialRequest,
  HttpCacheIndividualInterceptor
} from '@castcle-api/utils/interceptors';
import {
  DEFAULT_FEED_QUERY_OPTIONS,
  FeedItemMode,
  FeedsResponse
} from '@castcle-api/database/dtos';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiQuery
} from '@nestjs/swagger';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { Configs } from '@castcle-api/environments';
import {
  LimitPipe,
  PagePipe,
  SortByEnum,
  SortByPipe
} from '@castcle-api/utils/pipes';

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
export class FeedController {
  constructor(private rankerService: RankerService) {}
  private readonly logger = new CastLogger(
    FeedController.name,
    CastLoggerOptions
  );

  @ApiOkResponse({
    type: FeedsResponse
  })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'mode',
    enum: FeedItemMode,
    required: false
  })
  @ApiQuery({
    name: 'hashtag',
    type: String,
    required: false
  })
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
    name: 'exclude',
    type: String,
    required: false
  })
  @UseInterceptors(CredentialInterceptor)
  @UseInterceptors(HttpCacheIndividualInterceptor)
  @Get('feeds/feed/forYou')
  async getForYouFeed(
    @Req() req: CredentialRequest,
    @Query('mode')
    mode: string = DEFAULT_FEED_QUERY_OPTIONS.mode,
    @Query('sortBy', SortByPipe)
    sortByOption: {
      field: string;
      type: 'desc' | 'asc';
    } = DEFAULT_FEED_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    pageOption: number = DEFAULT_FEED_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_FEED_QUERY_OPTIONS.limit
  ) {
    const account = req.$credential.account;
    try {
      const feedItemsResult = await this.rankerService.getFeedItemsFromViewer(
        account,
        {
          mode: mode,
          sortBy: sortByOption,
          page: pageOption,
          limit: limitOption,
          ...DEFAULT_FEED_QUERY_OPTIONS
        }
      );
      return {
        payload: feedItemsResult.items.map((t) => t.toFeedItemPayload()),
        pagination: feedItemsResult.pagination
      } as FeedsResponse;
    } catch (error) {
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    }
  }
}
