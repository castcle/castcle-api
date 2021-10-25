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
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseInterceptors
} from '@nestjs/common';
import { AppService } from '../../app.service';
import {
  AuthenticationService,
  UserService,
  ContentService
} from '@castcle-api/database';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import {
  ContentResponse,
  ContentsResponse,
  ContentType,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  PageDto,
  PagesResponse,
  UpdatePageDto,
  PageResponse,
  PageResponseDto
} from '@castcle-api/database/dtos';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import {
  SortByPipe,
  PagePipe,
  LimitPipe,
  SortByEnum,
  ContentTypePipe
} from '@castcle-api/utils/pipes';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import {
  AVARTAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Image,
  ImageUploadOptions
} from '@castcle-api/utils/aws';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiQuery,
  ApiResponse
} from '@nestjs/swagger';
import { UserDocument, UserType } from '@castcle-api/database/schemas';
import { Query } from '@nestjs/common';
import {
  CastcleAuth,
  CastcleController,
  CastcleBasicAuth
} from '@castcle-api/utils/decorators';
import { CacheKeyName } from '@castcle-api/utils/cache';

@CastcleController('1.0')
@Controller()
export class PageController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService,
    private userService: UserService,
    private contentService: ContentService
  ) {}
  private readonly logger = new CastLogger(
    PageController.name,
    CastLoggerOptions
  );

  _uploadImage = (base64: string, options?: ImageUploadOptions) =>
    Image.upload(base64, options);

  /**
   * get Page(UserDocument) from idOrCastcleId if ownerAccount of page is not same in req.$credential will throw CastcleStatus.INVALID_ACCESS_TOKEN
   * @param {string} idOrCastCleId
   * @param {CredentialRequest} req
   * @returns {UserDocument} User schema that got from userService.getUserFromId() or authService.getUserFromCastcleId()
   */
  _getPageByIdOrCastcleId = async (
    idOrCastCleId: string,
    req: CredentialRequest
  ) => {
    const idResult = await this.userService.getUserFromId(idOrCastCleId);
    if (
      idResult &&
      idResult.type === UserType.Page &&
      String(idResult.ownerAccount) === String(req.$credential.account._id)
    )
      return idResult;
    else if (idResult && idResult.type === UserType.Page)
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
    const castcleIdResult = await this.authService.getUserFromCastcleId(
      idOrCastCleId
    );
    if (
      castcleIdResult &&
      castcleIdResult.type === UserType.Page &&
      String(castcleIdResult.ownerAccount) ===
        String(req.$credential.account._id)
    )
      return castcleIdResult;
    else if (castcleIdResult && castcleIdResult.type === UserType.Page)
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
    else
      throw new CastcleException(
        CastcleStatus.REQUEST_URL_NOT_FOUND,
        req.$language
      );
  };

  @ApiBody({
    type: PageResponse
  })
  @ApiResponse({
    status: 201,
    type: PageDto
  })
  @CastcleBasicAuth()
  @Post('pages')
  async createPage(@Req() req: CredentialRequest, @Body() body: PageDto) {
    //check if page name exist
    const namingResult = await this.authService.getUserFromCastcleId(
      body.castcleId
    );
    if (namingResult)
      throw new CastcleException(CastcleStatus.PAGE_IS_EXIST, req.$language);
    //TODO !!! performance issue
    const newBody = await this.appService.uploadPage(body);
    console.debug('newBody', newBody);
    const page = await this.userService.createPageFromCredential(
      req.$credential,
      newBody
    );
    return page.toPageResponse();
  }

  @ApiBody({
    type: UpdatePageDto
  })
  @ApiResponse({
    status: 201,
    type: PageDto
  })
  @HttpCode(201)
  @CastcleBasicAuth()
  @Put('pages/:id')
  async updatePage(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Body() body: UpdatePageDto
  ) {
    //check if page name exist
    const page = await this._getPageByIdOrCastcleId(id, req);
    if (!page.profile) page.profile = {};
    if (!page.profile.images) page.profile.images = {};
    //TODO !!! performance issue
    if (body.avatar)
      page.profile.images.avatar = (
        await this._uploadImage(body.avatar, {
          filename: `page-avatar-${id}`,
          sizes: AVARTAR_SIZE_CONFIGS
        })
      ).image;
    if (body.cover)
      page.profile.images.cover = (
        await this._uploadImage(body.cover, {
          filename: `page-cover-${id}`,
          sizes: COMMON_SIZE_CONFIGS
        })
      ).image;
    if (body.displayName) page.displayName = body.displayName;
    if (body.links) {
      if (!page.profile.socials) page.profile.socials = {};
      if (body.links.facebook)
        page.profile.socials.facebook = body.links.facebook;
      if (body.links.medium) page.profile.socials.medium = body.links.medium;
      if (body.links.twitter) page.profile.socials.twitter = body.links.twitter;
      if (body.links.youtube) page.profile.socials.youtube = body.links.youtube;
      if (body.links.website)
        page.profile.websites = [
          { website: body.links.website, detail: body.links.website }
        ];
    }
    const afterPage = await page.save();
    return afterPage.toPageResponse();
  }

  @ApiOkResponse({
    type: PageResponseDto
  })
  @CastcleAuth(CacheKeyName.Pages)
  @Get('pages/:id')
  async getPageFromId(
    @Req() req: CredentialRequest,
    @Param('id') id: string
  ): Promise<PageResponseDto> {
    //check if page name exist
    const page = await this._getPageByIdOrCastcleId(id, req);
    return page.toPageResponse();
  }

  @ApiOkResponse({
    type: PagesResponse
  })
  @CastcleAuth(CacheKeyName.Pages)
  @Get('pages')
  async getAllPages(
    @Query('sortBy', SortByPipe)
    sortByOption: {
      field: string;
      type: 'desc' | 'asc';
    } = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    pageOption: number = DEFAULT_CONTENT_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_CONTENT_QUERY_OPTIONS.limit
  ): Promise<PagesResponse> {
    const pages = await this.userService.getAllPages({
      page: pageOption,
      sortBy: sortByOption,
      limit: limitOption
    });
    return {
      payload: pages.items.map((p) => p.toPageResponse()),
      pagination: pages.pagination
    };
  }

  @ApiResponse({
    status: 204
  })
  @HttpCode(204)
  @CastcleBasicAuth()
  @Delete('pages/:id')
  async deletePage(@Req() req: CredentialRequest, @Param('id') id: string) {
    const page = await this._getPageByIdOrCastcleId(id, req);
    if (String(page.ownerAccount) === String(req.$credential.account._id)) {
      await page.delete();
      return '';
    } else
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
  }

  /**
   *
   * @param {string} idOrCastcleId of page
   * @param {CredentialRequest} req that contain current user credential
   * @returns {Promise<ContentsResponse>} all contents that has been map with contentService.getContentsFromUser()
   */

  @ApiOkResponse({
    type: ContentResponse
  })
  @CastcleAuth(CacheKeyName.Pages)
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
