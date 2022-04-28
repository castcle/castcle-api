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
  ContentService,
  ContentServiceV2,
  validateObjectId,
} from '@castcle-api/database';
import {
  LikingUserResponse,
  Meta,
  PaginationQuery,
  ResponseDto,
} from '@castcle-api/database/dtos';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { Delete, Get, Param, Post, Query } from '@nestjs/common';

@CastcleControllerV2({ path: 'contents' })
export class ContentControllerV2 {
  private logger = new CastLogger(ContentControllerV2.name);
  constructor(
    private contentServiceV2: ContentServiceV2,
    private contentService: ContentService
  ) {}

  private validateId(id: string) {
    this.logger.log(`Validate is object id: ${id}`);
    if (!validateObjectId(id)) throw CastcleException.CONTENT_NOT_FOUND;
  }

  @CastcleAuth(CacheKeyName.Contents)
  @Get(':contentId')
  async getContentFromId(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer,
    @Query() query: PaginationQuery
  ) {
    this.validateId(contentId);
    const content = await this.contentService.getContentById(contentId);
    if (!content) throw CastcleException.CONTENT_NOT_FOUND;
    const engagements = authorizer.user
      ? await this.contentService.getAllEngagementFromContentAndUser(
          content,
          authorizer.user
        )
      : [];

    return this.contentService.convertContentToContentResponse(
      authorizer.user,
      content,
      engagements,
      query.hasRelationshipExpansion
    );
  }

  @CastcleAuth(CacheKeyName.Contents)
  @Get(':contentId/farming')
  async getContentFarming(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer
  ) {
    this.logger.log(`Start get content farming from content: ${contentId}`);
    return this.contentServiceV2.pipeContentFarming(
      await this.contentServiceV2.getContentFarming(
        contentId,
        authorizer.account.id
      ),
      authorizer.account.id
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Post(':contentId/farm')
  async farmContent(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer
  ) {
    this.logger.log(`Start get all comment from content: ${contentId}`);
    return this.contentServiceV2.pipeContentFarming(
      await this.contentServiceV2.farm(contentId, authorizer.account.id),
      authorizer.account.id
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Delete(':contentId/farm')
  async unfarmContent(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer
  ) {
    this.logger.log(`Start get all comment from content: ${contentId}`);
    return this.contentServiceV2.pipeContentFarming(
      await this.contentServiceV2.unfarm(contentId, authorizer.account.id),
      authorizer.account.id
    );
  }

  @CastcleBasicAuth()
  @Get(':contentId/liking-users')
  async getLikingCast(
    @Auth() authorizer: Authorizer,
    @Param('contentId') contentId: string,
    @Query() query: PaginationQuery
  ) {
    this.logger.log(`Get Liking from content : ${contentId}`);
    authorizer.requestAccessForAccount(authorizer.account._id);
    const likingResponse = await this.contentServiceV2.getLikingCast(
      contentId,
      authorizer.account,
      query,
      authorizer.user
    );
    return ResponseDto.ok({
      payload: likingResponse.items,
      meta: Meta.fromDocuments(
        likingResponse.items as any,
        likingResponse.count
      ),
    } as LikingUserResponse);
  }
}
