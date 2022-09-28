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
  DEFAULT_QUERY_OPTIONS,
  GetKeywordQuery,
  GetTopTrendQuery,
  SearchServiceV2,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleController,
} from '@castcle-api/utils/decorators';
import { Get, Query } from '@nestjs/common';
import { KeywordHashtagPipe } from '../pipes/keyword.hashtag.pipe';

@CastcleController({ path: 'v2/searches' })
export class SearchesControllerV2 {
  constructor(private searchServiceV2: SearchServiceV2) {}

  @CastcleAuth(CacheKeyName.Users)
  @Get('search')
  getSearchByKeyword(
    @Auth() authorizer: Authorizer,
    @Query() query: GetKeywordQuery,
  ) {
    return this.searchServiceV2.getSearchByKeyword(query, authorizer.user);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get('by')
  getByKeyword(
    @Auth() authorizer: Authorizer,
    @Query() query: GetKeywordQuery,
  ) {
    return this.searchServiceV2.getByKeyword(query, authorizer.user);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get('mentions')
  getUserMentions(
    @Auth() authorizer: Authorizer,
    @Query() query: GetKeywordQuery,
  ) {
    return this.searchServiceV2.getUserMentions(query, authorizer.user);
  }

  @CastcleAuth(CacheKeyName.TopTrends)
  @Get('top-trends')
  getTopTrends(
    @Auth() authorizer: Authorizer,
    @Query() query: GetTopTrendQuery,
  ) {
    return this.searchServiceV2.getTopTrends(query, authorizer.user);
  }

  @CastcleAuth(CacheKeyName.Hashtags)
  @Get('hashtags')
  async hashtagSearch(@Query('keyword', KeywordHashtagPipe) keyword: string) {
    const result = await this.searchServiceV2.searchHashtag(keyword, {
      page: DEFAULT_QUERY_OPTIONS.page,
      limit: 10,
    });
    return {
      payload: result.map((hashtag, index) =>
        hashtag.toSearchTopTrendPayload(index),
      ),
    };
  }
}
