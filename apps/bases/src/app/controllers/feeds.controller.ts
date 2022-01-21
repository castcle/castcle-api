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

import { Get, Query, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { RankerService, UxEngagementService } from '@castcle-api/database';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import {
  PaginationQuery,
  DEFAULT_FEED_QUERY_OPTIONS,
  FeedItemMode,
  FeedsResponse,
  GetSearchRecentDto,
  ResponseDto
} from '@castcle-api/database/dtos';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import {
  LimitPipe,
  PagePipe,
  SortByEnum,
  SortByPipe
} from '@castcle-api/utils/pipes';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleController
} from '@castcle-api/utils/decorators';
import { ContentService, UserService } from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/utils/cache';

@CastcleController('1.0')
@UsePipes(new ValidationPipe({ skipMissingProperties: true }))
export class FeedsController {
  constructor(
    private rankerService: RankerService,
    private contentService: ContentService,
    private userService: UserService,
    private uxEngagementService: UxEngagementService
  ) {}

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
    sortByOption = DEFAULT_FEED_QUERY_OPTIONS.sortBy,
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
      if (!account.isGuest) {
        const user = await this.userService.getUserFromCredential(
          req.$credential
        );
        const contentIds = feedItemsResult.items.map((item) => item.content.id);
        const allContentsEngagements =
          await this.contentService.getAllEngagementFromContentIdsAndUser(
            contentIds,
            user.id
          );
        //track contentIds reach
        this.uxEngagementService.addReachToContents(
          contentIds,
          String(account._id)
        );
        return {
          payload: feedItemsResult.items.map((t) => {
            const engagements = allContentsEngagements.filter(
              (c) =>
                String(c.targetRef.$id) === String(t.content.id) ||
                String(c.targetRef.oid) === String(t.content.id)
            );
            return t.toFeedItemPayload(engagements);
          }),
          pagination: feedItemsResult.pagination
        } as FeedsResponse;
      }

      //
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

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('feeds/guests')
  async getGuestFeed(
    @Req() { $credential }: CredentialRequest,
    @Query() paginationQuery: PaginationQuery
  ) {
    const account = $credential.account;
    const feedItems = await this.rankerService.getGuestFeedItems(
      paginationQuery,
      account
    );

    this.uxEngagementService.addReachToContents(
      feedItems.payload.map((feed) => feed.payload.id),
      String(account._id)
    );

    return feedItems;
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('feeds/members/feed/forYou')
  async getMemberFeed(
    @Req() { $credential }: CredentialRequest,
    @Query() paginationQuery: PaginationQuery
  ) {
    const account = $credential.account;
    /*const feedItems = await this.rankerService.getMemberFeedItemsFromViewer(
      account,
      feedQuery
    );*/
    const feedItems = await this.rankerService.getGuestFeedItems(
      paginationQuery,
      account
    );

    this.uxEngagementService.addReachToContents(
      feedItems.payload.map((feed) => feed.payload.id),
      String(account._id)
    );

    return feedItems;
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('feeds/search/recent')
  async getSearchRecent(
    @Auth() { user }: Authorizer,
    @Query() getSearchRecentDto: GetSearchRecentDto
  ) {
    const { contents, meta } = await this.contentService.getSearchRecent(
      getSearchRecentDto
    );

    const { includes, payload } =
      await this.contentService.convertContentsToContentsResponse(
        user,
        contents,
        getSearchRecentDto.hasRelationshipExpansion
      );

    return ResponseDto.ok({ payload, includes, meta });
  }

  @CastcleAuth(CacheKeyName.Feeds)
  @Get('feeds/search/trends')
  async getSearchTrends(
    @Auth() { account, user }: Authorizer,
    @Query() getSearchTrendsDto: GetSearchRecentDto
  ) {
    const { contents, meta } = await this.contentService.getSearchRecent(
      getSearchTrendsDto
    );

    const sortedContents = await this.rankerService.sortContentsByScore(
      account.id,
      contents
    );

    const { includes, payload } =
      await this.contentService.convertContentsToContentsResponse(
        user,
        sortedContents,
        getSearchTrendsDto.hasRelationshipExpansion
      );

    return ResponseDto.ok({ payload, includes, meta });
  }
}
