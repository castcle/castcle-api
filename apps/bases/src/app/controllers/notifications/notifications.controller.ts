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
  ContentService,
  UserService
} from '@castcle-api/database';
import { Configs } from '@castcle-api/environments';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils';
import { HttpCacheInterceptor } from '@castcle-api/utils/interceptors';
import {
  ContentTypePipe,
  LimitPipe,
  PagePipe,
  SortByEnum,
  SortByPipe
} from '@castcle-api/utils/pipes';
import {
  CacheKey,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiQuery
} from '@nestjs/swagger';
import { AppService } from '../../app.service';

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
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService,
    private userService: UserService,
    private contentService: ContentService
  ) {}
  private readonly logger = new CastLogger(
    NotificationsController.name,
    CastLoggerOptions
  );

  @ApiBearerAuth()
  @ApiOkResponse({
    type: ContentResponse
  })
  //   @UseInterceptors(ContentsInterceptor)
  @UseInterceptors(HttpCacheInterceptor)
  @CacheKey(CacheKeyName.NotificationsGet)
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
    name: 'type',
    enum: ContentType,
    required: false
  })
  @Get('pages/:id/contents')
  async getPageContents(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption: {
      field: string;
      type: 'desc' | 'asc';
    } = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    pageOption: number = DEFAULT_CONTENT_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_CONTENT_QUERY_OPTIONS.limit,
    @Query('type', ContentTypePipe)
    contentTypeOption: ContentType = DEFAULT_CONTENT_QUERY_OPTIONS.type
  ): Promise<ContentsResponse> {
    const page = await this._getPageByIdOrCastcleId(id, req);
    const contents = await this.contentService.getContentsFromUser(page, {
      sortBy: sortByOption,
      limit: limitOption,
      page: pageOption,
      type: contentTypeOption
    });
    return {
      payload: contents.items.map((c) => c.toContentPayload()),
      pagination: contents.pagination
    };
  }
}
