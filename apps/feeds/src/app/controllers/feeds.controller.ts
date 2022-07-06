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
  ContentPayloadItem,
  ContentService,
  EntityVisibility,
  FeedQuery,
  GetSearchRecentDto,
  RankerService,
  ResponseDto,
  UxEngagementService,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleController,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import {
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { FeedParam } from '../dtos';
import { SuggestionService } from '../services';

@CastcleController({ path: 'feeds', version: '1.0' })
export class FeedsController {
  constructor(
    private contentService: ContentService,
    private rankerService: RankerService,
    private suggestionService: SuggestionService,
    private uxEngagementService: UxEngagementService,
    private authService: AuthenticationService,
  ) {}

  @CastcleBasicAuth()
  @Post(':id/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  async seenFeed(
    @Auth() { account, credential }: Authorizer,
    @Param() { id }: FeedParam,
  ) {
    this.suggestionService.seen(account, id, credential);
  }

  @CastcleBasicAuth()
  @Post(':id/off-view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async offScreenFeed(
    @Auth() { account }: Authorizer,
    @Param() { id }: FeedParam,
  ) {
    if (account.isGuest) return;

    await this.rankerService.offScreenFeedItem(account, id);
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('guests')
  async getGuestFeed(
    @Auth() { account }: Authorizer,
    @Query() paginationQuery: FeedQuery,
  ) {
    const feedItems = await this.rankerService.getGuestFeedItems(
      paginationQuery,
      account,
    );

    const contentIds = feedItems.payload.map(
      (feed) => (feed.payload as ContentPayloadItem).id,
    );

    await this.uxEngagementService.addReachToContents(
      String(account._id),
      contentIds,
    );

    return this.suggestionService.suggest(account.id, feedItems);
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('members/feed/forYou')
  async getMemberFeed(
    @Req() { $credential }: CredentialRequest,
    @Query() paginationQuery: FeedQuery,
  ) {
    const account = await this.authService.getAccountFromCredential(
      $credential,
    );

    if (account.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }

    const feedItems = await this.rankerService.getFeeds(
      account,
      paginationQuery,
    );

    this.uxEngagementService.addReachToContents(
      String(account._id),
      feedItems.payload.map((feed) => (feed.payload as ContentPayloadItem).id),
    );

    return this.suggestionService.suggest(account.id, feedItems);
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('search/recent')
  async getSearchRecent(
    @Auth() { user }: Authorizer,
    @Query() getSearchRecentDto: GetSearchRecentDto,
  ) {
    const { contents, meta } = await this.contentService.getSearchRecent(
      getSearchRecentDto,
    );

    const { includes, payload } =
      await this.contentService.convertContentsToContentsResponse(
        user,
        contents,
        getSearchRecentDto.hasRelationshipExpansion,
      );

    return ResponseDto.ok({ payload, includes, meta });
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('search/trends')
  async getSearchTrends(
    @Auth() { account, user }: Authorizer,
    @Query() getSearchTrendsDto: GetSearchRecentDto,
  ) {
    const { contents, meta } = await this.contentService.getSearchRecent(
      getSearchTrendsDto,
    );

    const sortedContents = await this.rankerService.sortContentsByScore(
      account.id,
      contents,
    );

    const { includes, payload } =
      await this.contentService.convertContentsToContentsResponse(
        user,
        sortedContents,
        getSearchTrendsDto.hasRelationshipExpansion,
      );

    return ResponseDto.ok({ payload, includes, meta });
  }
}
