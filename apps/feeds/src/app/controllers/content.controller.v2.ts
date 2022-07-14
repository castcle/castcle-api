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
  CreateContentDto,
  EngagementType,
  GetContentDto,
  PaginationQuery,
  ReportingStatus,
} from '@castcle-api/database';
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
import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SaveContentPipe } from '../pipes/save-content.pipe';

@CastcleControllerV2({ path: 'contents' })
export class ContentControllerV2 {
  private logger = new CastLogger(ContentControllerV2.name);

  constructor(private contentServiceV2: ContentServiceV2) {}

  @CastcleAuth(CacheKeyName.Contents)
  @Get(':contentId')
  getContent(
    @Param() { contentId }: GetContentDto,
    @Auth() authorizer: Authorizer,
    @Query() { hasRelationshipExpansion }: PaginationQuery,
  ) {
    this.logger.log(`Get casts from content : ${contentId}`);

    return this.contentServiceV2.getContent(
      contentId,
      authorizer.user,
      hasRelationshipExpansion,
    );
  }

  @CastcleAuth(CacheKeyName.Contents)
  @Get(':contentId/farming')
  async getContentFarming(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer,
  ) {
    this.logger.log(`Start get content farming from content: ${contentId}`);
    return this.contentServiceV2.pipeContentFarming(
      await this.contentServiceV2.getContentFarming(
        contentId,
        authorizer.account.id,
      ),
      authorizer.account.id,
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Post(':contentId/farm')
  async farmContent(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer,
  ) {
    this.logger.log(`Start get all comment from content: ${contentId}`);
    return this.contentServiceV2.pipeContentFarming(
      await this.contentServiceV2.farm(contentId, authorizer.account.id),
      authorizer.account.id,
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Delete(':contentId/farm')
  async unfarmContent(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer,
  ) {
    this.logger.log(`Start get all comment from content: ${contentId}`);
    return this.contentServiceV2.pipeContentFarming(
      await this.contentServiceV2.unfarm(contentId, authorizer.account.id),
      authorizer.account.id,
    );
  }

  @CastcleBasicAuth()
  @Get(':contentId/liking-users')
  getLikingCast(
    @Auth() authorizer: Authorizer,
    @Param() { contentId }: GetContentDto,
    @Query() query: PaginationQuery,
  ) {
    this.logger.log(`Get Liking from content : ${contentId}`);
    authorizer.requestAccessForAccount(authorizer.account._id);
    return this.contentServiceV2.getEngagementCast(
      contentId,
      authorizer.account,
      query,
      EngagementType.Like,
      authorizer.user,
    );
  }

  @CastcleBasicAuth()
  @Get(':contentId/recasts')
  getRecastBy(
    @Auth() authorizer: Authorizer,
    @Param() { contentId }: GetContentDto,
    @Query() query: PaginationQuery,
  ) {
    this.logger.log(`Get Recasts from content : ${contentId}`);
    authorizer.requestAccessForAccount(authorizer.account._id);
    return this.contentServiceV2.getEngagementCast(
      contentId,
      authorizer.account,
      query,
      EngagementType.Recast,
      authorizer.user,
    );
  }

  @CastcleBasicAuth()
  @Get(':contentId/quotecasts')
  getQuoteCastBy(
    @Auth() authorizer: Authorizer,
    @Param() { contentId }: GetContentDto,
    @Query() query: PaginationQuery,
  ) {
    this.logger.log(`Get quote casts from content : ${contentId}`);
    authorizer.requestAccessForAccount(authorizer.account._id);
    return this.contentServiceV2.getQuoteByCast(
      contentId,
      query,
      authorizer.user,
    );
  }

  @CastcleBasicAuth()
  @Post('feed')
  createFeedContent(
    @Auth() authorizer: Authorizer,
    @Body(new SaveContentPipe()) body: CreateContentDto,
  ) {
    authorizer.requireActivation();

    return this.contentServiceV2.createContent(body, authorizer.user);
  }

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':contentId')
  async deleteContentFromId(
    @Auth() authorizer: Authorizer,
    @Param() { contentId }: GetContentDto,
  ) {
    authorizer.requireActivation();

    await this.contentServiceV2.deleteContent(contentId, authorizer.user);
  }

  @CastcleAuth(CacheKeyName.Contents)
  @Get(':contentId/participates')
  getParticipates(
    @Auth() authorizer: Authorizer,
    @Param() { contentId }: GetContentDto,
  ) {
    if (authorizer.account.isGuest) throw new CastcleException('FORBIDDEN');

    return this.contentServiceV2.getParticipates(contentId, authorizer.account);
  }

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Post(':contentId/appeal')
  @HttpCode(HttpStatus.NO_CONTENT)
  async appealContent(
    @Auth() { user }: Authorizer,
    @Param() { contentId }: GetContentDto,
  ) {
    await this.contentServiceV2.updateAppealContent(
      contentId,
      user,
      ReportingStatus.APPEAL,
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Post(':contentId/not-appeal')
  @HttpCode(HttpStatus.NO_CONTENT)
  async notAppealContent(
    @Auth() { user }: Authorizer,
    @Param() { contentId }: GetContentDto,
  ) {
    await this.contentServiceV2.updateAppealContent(
      contentId,
      user,
      ReportingStatus.NOT_APPEAL,
    );
  }
}
