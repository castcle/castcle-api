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
  Param,
  Put,
  Req,
  UseInterceptors
} from '@nestjs/common';
import { AppService } from './app.service';
import {
  UserService,
  ContentService,
  AuthenticationService
} from '@castcle-api/database';
import { ImageInterceptor } from './interceptors/image.interceptor';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { ApiBody, ApiOkResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  ContentType,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  FollowResponse,
  UpdateUserDto,
  UserResponseDto
} from '@castcle-api/database/dtos';
import {
  SortByPipe,
  PagePipe,
  LimitPipe,
  ContentTypePipe,
  SortByEnum
} from '@castcle-api/utils/pipes';
import { UserDocument, UserType } from '@castcle-api/database/schemas';
import { ContentsResponse } from '@castcle-api/database/dtos';
import { Query } from '@nestjs/common';
import {
  CastcleAuth,
  CastcleController,
  CastcleBasicAuth
} from '@castcle-api/utils/decorators';
import { CacheKeyName } from '@castcle-api/utils/cache';

let logger: CastLogger;

@CastcleController('1.0')
export class UserController {
  constructor(
    private readonly appService: AppService,
    private userService: UserService,
    private contentService: ContentService,
    private authService: AuthenticationService
  ) {
    logger = new CastLogger(UserController.name, CastLoggerOptions);
  }

  /**
   *
   * @param {string} idOrCastcleId
   * @param {CredentialRequest} req
   * @returns {UserDocument} from userService.getUserFromId() or authService.getUserFromCastcleId
   * @throws {CastcleException} with CastcleStatus.REQUEST_URL_NOT_FOUND
   */
  _getUserFromIdOrCastcleId = async (
    idOrCastcleId: string,
    req: CredentialRequest
  ) => {
    const user = await this.userService.getUserFromId(idOrCastcleId);
    if (user) return user;
    const userFromCastcleId = await this.authService.getUserFromCastcleId(
      idOrCastcleId
    );
    if (userFromCastcleId) return userFromCastcleId;
    else
      throw new CastcleException(
        CastcleStatus.REQUEST_URL_NOT_FOUND,
        req.$language
      );
  };

  @Get()
  getData() {
    logger.log('Root');
    return this.appService.getData();
  }

  @ApiOkResponse({
    type: UserResponseDto
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get('me')
  async getMyData(@Req() req: CredentialRequest) {
    //UserService
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) return await user.toUserResponse();
    else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }

  @ApiOkResponse({
    type: UserResponseDto
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get(':id')
  async getUserById(@Req() req: CredentialRequest, @Param('id') id: string) {
    //UserService
    const user = await this._getUserFromIdOrCastcleId(id, req);
    return await user.toUserResponse();
  }

  @ApiBody({
    type: UpdateUserDto
  })
  @ApiOkResponse({
    type: UserResponseDto
  })
  @CastcleBasicAuth()
  @UseInterceptors(ImageInterceptor)
  @Put('me')
  async updateMyData(
    @Req() req: CredentialRequest,
    @Body() body: UpdateUserDto
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      const afterUpdateUser = await this.userService.updateUser(user, body);
      const response = await afterUpdateUser.toUserResponse();
      return response;
    } else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }

  @ApiResponse({
    status: 204
  })
  @CastcleBasicAuth()
  @Delete('me')
  async deleteMyData(@Req() req: CredentialRequest) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      //await user.delete();
      await this.userService.deactive(user);
      return '';
    } else {
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
    }
  }

  @ApiOkResponse({
    type: ContentsResponse
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get('me/contents')
  async getMyContents(
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
    //UserService
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      const contents = await this.contentService.getContentsFromUser(user, {
        limit: limitOption,
        sortBy: sortByOption,
        page: pageOption,
        type: contentTypeOption
      });
      return {
        payload: contents.items.map((item) => item.toContentPayload()),
        pagination: contents.pagination
      } as ContentsResponse;
    } else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }

  @ApiOkResponse({
    type: ContentsResponse
  })
  @ApiQuery({ name: 'type', enum: ContentType })
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
  @CastcleAuth(CacheKeyName.Users)
  @Get(':id/contents')
  async getUserContents(
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
    //UserService
    const user = await this._getUserFromIdOrCastcleId(id, req);
    const contents = await this.contentService.getContentsFromUser(user, {
      limit: limitOption,
      page: pageOption,
      sortBy: sortByOption,
      type: contentTypeOption
    });
    return {
      payload: contents.items.map((item) => item.toContentPayload()),
      pagination: contents.pagination
    } as ContentsResponse;
  }

  /**
   * User {castcleId} follow user from {Id} by
   * @param {string} id idOrCastcleId that user want to follow
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {string} castcleId Body.castcleId
   * @returns {''}
   */
  @ApiResponse({
    status: 204
  })
  @CastcleBasicAuth()
  @Put(':id/follow')
  async follow(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Body('castcleId') castcleId: string
  ) {
    const followedUser = await this._getUserFromIdOrCastcleId(id, req);
    const currentUser = await this._getUserFromIdOrCastcleId(castcleId, req);
    if (!currentUser.ownerAccount === req.$credential.account._id)
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    await currentUser.follow(followedUser);
    return '';
  }

  /**
   * User {castcleId} unfollow user from {Id} by
   * @param {string} id idOrCastcleId that user want to follow
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {string} castcleId Body.castcleId
   * @returns {''}
   */
  @ApiResponse({
    status: 204
  })
  @CastcleBasicAuth()
  @Put(':id/unfollow')
  async unfollow(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Body('castcleId') castcleId: string
  ) {
    const followedUser = await this._getUserFromIdOrCastcleId(id, req);
    const currentUser = await this._getUserFromIdOrCastcleId(castcleId, req);
    if (!currentUser.ownerAccount === req.$credential.account._id)
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    await currentUser.unfollow(followedUser);
    return '';
  }

  @ApiOkResponse({
    type: FollowResponse
  })
  @CastcleAuth(CacheKeyName.Users)
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
    enum: UserType,
    required: false
  })
  @Get(':id/follower')
  async getUserFollower(
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
    @Query('type')
    userTypeOption?: UserType
  ): Promise<FollowResponse> {
    //UserService
    const user = await this._getUserFromIdOrCastcleId(id, req);
    const followers = await this.userService.getFollower(user, {
      limit: limitOption,
      page: pageOption,
      sortBy: sortByOption,
      type: userTypeOption
    });
    return {
      payload: followers.items,
      pagination: followers.pagination
    } as FollowResponse;
  }

  @ApiOkResponse({
    type: FollowResponse
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
    name: 'type',
    enum: UserType,
    required: false
  })
  @Get(':id/following')
  @CastcleAuth(CacheKeyName.Users)
  async getUserFollowing(
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
    @Query('type')
    userTypeOption?: UserType
  ): Promise<FollowResponse> {
    //UserService
    const user = await this._getUserFromIdOrCastcleId(id, req);
    const followers = await this.userService.getFollowing(user, {
      limit: limitOption,
      page: pageOption,
      sortBy: sortByOption,
      type: userTypeOption
    });
    return {
      payload: followers.items,
      pagination: followers.pagination
    } as FollowResponse;
  }
}
