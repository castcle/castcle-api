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
import { SearchService } from '@castcle-api/database';
import {
  DEFAULT_TOP_TREND_QUERY_OPTIONS,
  SearchResponse,
  TopTrendsResponse,
} from '@castcle-api/database/dtos';
import { Configs } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  CredentialInterceptor,
  CredentialRequest,
  HttpCacheIndividualInterceptor,
  HttpCacheSharedWithQueryInterceptor,
} from '@castcle-api/utils/interceptors';
import { LimitPipe } from '@castcle-api/utils/pipes';
import {
  CacheKey,
  CacheTTL,
  Controller,
  Get,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';

@ApiHeader({
  name: Configs.RequiredHeaders.AcceptLanguage.name,
  description: Configs.RequiredHeaders.AcceptLanguage.description,
  example: Configs.RequiredHeaders.AcceptLanguage.example,
  required: true,
})
@ApiHeader({
  name: Configs.RequiredHeaders.AcceptVersion.name,
  description: Configs.RequiredHeaders.AcceptVersion.description,
  example: Configs.RequiredHeaders.AcceptVersion.example,
  required: true,
})
@Controller({
  version: '1.0',
})
@Controller()
export class SearchesController {
  private logger = new CastLogger(SearchesController.name);

  constructor(private searchService: SearchService) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    type: TopTrendsResponse,
  })
  @UseInterceptors(HttpCacheSharedWithQueryInterceptor)
  @CacheKey(CacheKeyName.TopTrends.Name)
  @CacheTTL(CacheKeyName.TopTrends.Ttl)
  @UseInterceptors(CredentialInterceptor)
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'exclude',
    type: String,
    required: false,
  })
  @Get('searches/topTrends')
  async getTopTrends(
    @Req() req: CredentialRequest,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_TOP_TREND_QUERY_OPTIONS.limit,
    @Query('exclude')
    excludeOption: string = DEFAULT_TOP_TREND_QUERY_OPTIONS.exclude
  ): Promise<TopTrendsResponse> {
    this.logger.log('Start get top trends');
    const result = await this.searchService.getTopTrends({
      limit: limitOption,
      exclude: excludeOption,
    });
    this.logger.log('Success get top trends');

    return {
      hashtags: result.hashtags.map((hashtag, index) =>
        hashtag.toSearchTopTrendhPayload(index)
      ),
      follows: result.follows.map((user) => user.toSearchTopTrendResponse()),
      topics: [],
    };
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    type: SearchResponse,
  })
  @UseInterceptors(HttpCacheIndividualInterceptor)
  @CacheKey(CacheKeyName.Searches.Name)
  @CacheTTL(CacheKeyName.Searches.Ttl)
  @UseInterceptors(CredentialInterceptor)
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'keyword',
    type: String,
    required: false,
  })
  @Get('searches')
  async getSearches(
    @Req() req: CredentialRequest,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_TOP_TREND_QUERY_OPTIONS.limit,
    @Query('keyword')
    keyword: string
  ): Promise<SearchResponse> {
    this.logger.log(`Start get search key : ${keyword}`);
    const result = await this.searchService.getSearch(
      req.$credential,
      keyword,
      limitOption
    );
    this.logger.log('Success get search');
    return {
      keyword: result.keywords,
      hashtags: result.hashtags.map((hashtag) => hashtag.toSearchPayload()),
      follows: result.follows.map((user) => user.toSearchResponse()),
    };
  }
}
