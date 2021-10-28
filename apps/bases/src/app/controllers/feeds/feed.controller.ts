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

import { Get, Query, Req } from '@nestjs/common';
import { RankerService } from '@castcle-api/database';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import {
  DEFAULT_FEED_QUERY_OPTIONS,
  FeedItemMode,
  FeedsResponse
} from '@castcle-api/database/dtos';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import {
  LimitPipe,
  PagePipe,
  SortByEnum,
  SortByPipe
} from '@castcle-api/utils/pipes';
import { CastcleAuth, CastcleController } from '@castcle-api/utils/decorators';
import { CacheKeyName } from '@castcle-api/utils/cache';

@CastcleController('1.0')
export class FeedController {
  constructor(private rankerService: RankerService) {}
  private readonly logger = new CastLogger(
    FeedController.name,
    CastLoggerOptions
  );

  @ApiOkResponse({
    type: FeedsResponse
  })
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
  @CastcleAuth(CacheKeyName.Feeds)
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
          ...DEFAULT_FEED_QUERY_OPTIONS,
          mode: mode,
          sortBy: sortByOption,
          page: pageOption,
          limit: limitOption
        }
      );
      console.debug('rankerFeeds', feedItemsResult);
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
