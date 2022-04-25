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
import { ContentServiceV2 } from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { Delete, Get, Param, Post } from '@nestjs/common';

@CastcleControllerV2({ path: 'contents' })
export class ContentControllerV2 {
  private logger = new CastLogger(ContentControllerV2.name);
  constructor(private contentService: ContentServiceV2) {}

  @CastcleAuth(CacheKeyName.Comments)
  @Get(':contentId/farming')
  async getContentFarming(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer
  ) {
    this.logger.log(`Start get content farming from content: ${contentId}`);
    return this.contentService.pipeContentFarming(
      await this.contentService.getContentFarming(
        contentId,
        authorizer.account.id
      ),
      authorizer.account.id
    );
  }

  @CastcleAuth(CacheKeyName.Comments)
  @Post(':contentId/farm')
  async farmContent(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer
  ) {
    this.logger.log(`Start get all comment from content: ${contentId}`);
    return this.contentService.pipeContentFarming(
      await this.contentService.farm(contentId, authorizer.account.id),
      authorizer.account.id
    );
  }

  @CastcleAuth(CacheKeyName.Comments)
  @Delete(':contentId/farm')
  async unfarmContent(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer
  ) {
    this.logger.log(`Start get all comment from content: ${contentId}`);
    return this.contentService.pipeContentFarming(
      await this.contentService.unfarm(contentId, authorizer.account.id),
      authorizer.account.id
    );
  }
}
