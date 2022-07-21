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
  ContentServiceV2,
  FeedQuery,
  GetSearchQuery,
  SuggestionServiceV2,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { FeedParam } from '../dtos';

@CastcleControllerV2({ path: 'feeds' })
export class FeedsControllerV2 {
  constructor(
    private contentServiceV2: ContentServiceV2,
    private suggestionServiceV2: SuggestionServiceV2,
  ) {}

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('search/recent')
  getSearchRecent(
    @Auth() authorizer: Authorizer,
    @Query() query: GetSearchQuery,
  ) {
    return this.contentServiceV2.getSearchRecent(query, authorizer.user);
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('search/trends')
  getSearchTrends(
    @Auth() authorizer: Authorizer,
    @Query() query: GetSearchQuery,
  ) {
    return this.contentServiceV2.getSearchTrends(
      query,
      authorizer.user,
      authorizer.account,
      authorizer.credential.accessToken,
    );
  }

  @CastcleBasicAuth()
  @Post(':id/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  async seenFeed(
    @Auth() { account, credential }: Authorizer,
    @Param() { id }: FeedParam,
  ) {
    await this.suggestionServiceV2.seenV2(account, id, credential);
  }

  @CastcleBasicAuth()
  @Post(':id/off-view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async offScreenFeed(
    @Auth() { account }: Authorizer,
    @Param() { id }: FeedParam,
  ) {
    if (account.isGuest) return;

    await this.contentServiceV2.offViewFeedItem(account.id, id);
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('recent/forYou')
  async getRecentFeeds(
    @Auth() { account, user }: Authorizer,
    @Query() query: FeedQuery,
  ) {
    return this.contentServiceV2.generateFeeds(query, account._id, user);
  }
}
