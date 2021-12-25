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
  createCastcleMeta,
  SocialSyncService,
  UserService
} from '@castcle-api/database';
import {
  CastcleIncludes,
  ContentsResponse,
  ContentType,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  DEFAULT_QUERY_OPTIONS,
  FollowResponse,
  PageResponseDto,
  PagesResponse,
  SocialSyncDeleteDto,
  SocialSyncDto,
  UpdateUserDto,
  UserResponseDto
} from '@castcle-api/database/dtos';
import {
  CredentialDocument,
  OtpObjective,
  UserType
} from '@castcle-api/database/schemas';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  CastcleAuth,
  CastcleBasicAuth,
  CastcleController,
  CastleClearCacheAuth
} from '@castcle-api/utils/decorators';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import {
  ContentTypePipe,
  LimitPipe,
  PagePipe,
  SortByEnum,
  SortByPipe
} from '@castcle-api/utils/pipes';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SocialProvider } from '@castcle-api/database';
import { AppService } from './app.service';
import { ReportUserDto } from './dtos';
import { TargetCastcleDto, UpdateMobileDto } from './dtos/dto';
import { KeywordPipe } from './pipes/keyword.pipe';

let logger: CastLogger;

class DeleteUserBody {
  channel: string;
  payload: {
    password: string;
  };
}

@CastcleController('1.0')
export class UserController {
  constructor(
    private readonly appService: AppService,
    private userService: UserService,
    private contentService: ContentService,
    private authService: AuthenticationService,
    private socialSyncService: SocialSyncService
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
    name: 'keyword',
    type: String,
    required: true
  })
  @Get('mentions')
  @CastcleAuth(CacheKeyName.Users)
  async getMentions(
    @Req() { $credential }: CredentialRequest,
    @Query('keyword', KeywordPipe) keyword: string,
    @Query('page', PagePipe)
    pageOption: number = DEFAULT_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_QUERY_OPTIONS.limit
  ) {
    const authorizedUser = await this.userService.getUserFromCredential(
      $credential
    );
    const { pagination, users } = await this.userService.getMentionsFromPublic(
      authorizedUser,
      keyword,
      { page: pageOption, limit: limitOption }
    );

    return {
      message: 'success message',
      payload: users,
      pagination
    };
  }

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

  @CastcleAuth(CacheKeyName.SyncSocial)
  @Get('syncSocial')
  async getSyncSocial(@Req() req: CredentialRequest) {
    logger.log(`start get all my sync social.`);

    logger.log(`Get user.`);
    const user = await this.userService.getUserFromCredential(req.$credential);

    logger.log(`Get social from user.`);
    const social = await this.socialSyncService.getSocialSyncByUser(user);
    const response = {};

    logger.log(`Generate response.`);
    for (const item in SocialProvider) {
      const data = social.find((x) => x.provider === SocialProvider[item]);
      const key = SocialProvider[item];
      response[key] = data ? data.toSocialSyncPayload() : null;
    }
    return response;
  }

  @ApiOkResponse({ type: UserResponseDto })
  @CastcleAuth(CacheKeyName.Users)
  @Get(':id')
  async getUserById(@Req() req: CredentialRequest, @Param('id') id: string) {
    const authorizedUser = await this.userService.getUserFromCredential(
      req.$credential
    );

    return this.userService.getById(authorizedUser, id, UserType.People);
  }

  @ApiBody({
    type: UpdateUserDto
  })
  @ApiOkResponse({
    type: UserResponseDto
  })
  @CastleClearCacheAuth(CacheKeyName.Users)
  @Put('me')
  async updateMyData(
    @Req() req: CredentialRequest,
    @Body() body: UpdateUserDto
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      const newBody = await this.appService.uploadUserInfo(body, req);
      const afterUpdateUser = await this.userService.updateUser(user, newBody);
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
  @ApiBody({
    type: DeleteUserBody
  })
  @CastleClearCacheAuth(CacheKeyName.Users)
  @Delete('me')
  async deleteMyData(
    @Body('channel') channel: string,
    @Body('payload') passwordPayload: { password: string },
    @Req() req: CredentialRequest
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      const account = await this.authService.getAccountFromCredential(
        req.$credential
      );
      if (
        channel === 'email' &&
        (await account.verifyPassword(passwordPayload.password))
      ) {
        await this.userService.deactive(user);
        return '';
      } else
        throw new CastcleException(
          CastcleStatus.INVALID_PASSWORD,
          req.$language
        );
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
  @ApiQuery({
    name: 'sinceId',
    required: false
  })
  @ApiQuery({
    name: 'untilId',
    required: false
  })
  @ApiQuery({
    name: 'maxResult',
    required: false
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
    @Query('sinceId') sinceId?: string,
    @Query('untilId') untilId?: string,
    @Query('maxResult', LimitPipe)
    limitOption: number = DEFAULT_CONTENT_QUERY_OPTIONS.maxResults
  ): Promise<ContentsResponse> {
    //UserService
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      const contents = await this.contentService.getContentsFromUser(user.id, {
        sinceId: sinceId,
        sortBy: sortByOption,
        untilId: untilId,
        maxResults: limitOption
      });
      const engagements =
        await this.contentService.getAllEngagementFromContentsAndUser(
          contents.items,
          user.id
        );

      return {
        payload: contents.items.map((item) => {
          const subEngagements = engagements.filter(
            (eng) =>
              String(eng.targetRef.$id) === String(item._id) ||
              String(eng.targetRef.oid) === String(item.id)
          );

          return item.toContentPayloadItem(subEngagements);
        }),
        includes: new CastcleIncludes({
          users: contents.items.map(({ author }) => author)
        }),
        meta: createCastcleMeta(contents.items)
      } as ContentsResponse;
    } else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }

  @ApiOkResponse({
    type: PagesResponse
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get('me/pages')
  async getMyPages(
    @Req() { $credential }: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption: {
      field: string;
      type: 'desc' | 'asc';
    } = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    pageOption: number = DEFAULT_QUERY_OPTIONS.page
  ): Promise<PagesResponse> {
    const user = await this.userService.getUserFromCredential($credential);
    const { users: pages, pagination } = await this.userService.getByCriteria(
      user,
      { ownerAccount: $credential.account._id, type: UserType.Page },
      { page: pageOption, sortBy: sortByOption }
    );

    return { pagination, payload: pages as PageResponseDto[] };
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
    @Req() { $credential }: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption: {
      field: string;
      type: 'desc' | 'asc';
    } = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
    @Query('maxResults', LimitPipe) maxResults?: number,
    @Query('sinceId') sinceId?: string,
    @Query('untilId') untilId?: string,
    @Query('type', ContentTypePipe)
    contentTypeOption: ContentType = DEFAULT_CONTENT_QUERY_OPTIONS.type
  ): Promise<ContentsResponse> {
    const user = await this.userService.getUserFromCredential($credential);
    const targetUser = await this.userService.getById(
      user,
      id,
      UserType.People
    );
    const contents = await this.contentService.getContentsFromUser(
      targetUser.id,
      {
        maxResults: maxResults,
        sinceId: sinceId,
        untilId: untilId,
        sortBy: sortByOption,
        type: contentTypeOption
      }
    );
    const engagements =
      await this.contentService.getAllEngagementFromContentsAndUser(
        contents.items,
        user?.id
      );
    return {
      payload: contents.items.map((item) => {
        const subEngagements = engagements.filter(
          (eng) =>
            String(eng.targetRef.$id) === String(item._id) ||
            String(eng.targetRef.oid) === String(item.id)
        );
        return item.toContentPayloadItem(subEngagements);
      }),
      includes: new CastcleIncludes({
        users: contents.items.map(({ author }) => author)
      }),
      meta: createCastcleMeta(contents.items)
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
  @ApiBody({
    type: TargetCastcleDto
  })
  @CastleClearCacheAuth(CacheKeyName.Users)
  @Put(':id/following')
  async follow(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Body() body: TargetCastcleDto
  ) {
    const currentUser = await this._getUserFromIdOrCastcleId(id, req);
    const followedUser = await this._getUserFromIdOrCastcleId(
      body.targetCastcleId,
      req
    );
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
  @ApiBody({
    type: TargetCastcleDto
  })
  @CastleClearCacheAuth(CacheKeyName.Users)
  @Put(':id/unfollow')
  async unfollow(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Body() body: TargetCastcleDto
  ) {
    const currentUser = await this._getUserFromIdOrCastcleId(id, req);
    const followedUser = await this._getUserFromIdOrCastcleId(
      body.targetCastcleId,
      req
    );
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
  @Get(':id/followers')
  async getUserFollower(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption: {
      field: string;
      type: 'desc' | 'asc';
    } = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    pageOption: number = DEFAULT_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_QUERY_OPTIONS.limit,
    @Query('type')
    userTypeOption?: UserType
  ): Promise<FollowResponse> {
    const authorizedUser = await this.userService.getUserFromCredential(
      req.$credential
    );
    const { users, pagination } = await this.userService.getFollowers(
      authorizedUser,
      id,
      {
        limit: limitOption,
        page: pageOption,
        sortBy: sortByOption,
        type: userTypeOption
      }
    );

    return { pagination, payload: users };
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
    pageOption: number = DEFAULT_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_QUERY_OPTIONS.limit,
    @Query('type')
    userTypeOption?: UserType
  ): Promise<FollowResponse> {
    const authorizedUser = await this.userService.getUserFromCredential(
      req.$credential
    );
    const { users, pagination } = await this.userService.getFollowing(
      authorizedUser,
      id,
      {
        limit: limitOption,
        page: pageOption,
        sortBy: sortByOption,
        type: userTypeOption
      }
    );

    return { payload: users, pagination: pagination };
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Post(':id/blocking')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async blockUser(
    @Param('id') blockUserId: string,
    @Req() req: CredentialRequest
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    const blockUser = await this.userService.getByIdOrCastcleId(blockUserId);

    await this.userService.blockUser(user, blockUser);
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Post(':id/unblocking')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblockUser(
    @Param('id') unblockUserId: string,
    @Req() req: CredentialRequest
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    const unblockUser = await this.userService.getByIdOrCastcleId(
      unblockUserId
    );

    await this.userService.unblockUser(user, unblockUser);
  }

  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Post(':id/reporting')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportUser(
    @Body() { message }: ReportUserDto,
    @Param('id') reportedUserId: string,
    @Req() req: CredentialRequest
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    const reportedUser = await this.userService.getByIdOrCastcleId(
      reportedUserId
    );

    await this.userService.reportUser(user, reportedUser, message);
  }

  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiBody({
    type: UpdateMobileDto
  })
  @ApiOkResponse({
    type: UserResponseDto
  })
  @CastleClearCacheAuth(CacheKeyName.Users)
  @Put('me/mobile')
  async updateMobile(
    @Req() req: CredentialRequest,
    @Body() body: UpdateMobileDto
  ) {
    if (body.objective !== OtpObjective.VerifyMobile) {
      logger.error(`Invalid objective.`);
      throw new CastcleException(
        CastcleStatus.PAYLOAD_TYPE_MISMATCH,
        req.$language
      );
    }

    const dupAccount = await this.authService.getAccountFromMobile(
      body.mobileNumber,
      body.countryCode
    );

    if (dupAccount) {
      logger.error(
        'Dupplicate mobile : ' + body.countryCode + body.mobileNumber
      );
      throw new CastcleException(
        CastcleStatus.MOBILE_NUMBER_IS_EXIST,
        req.$language
      );
    }

    logger.log('Get otp document');
    const otp = await this.authService.getOtpFromRequestIdRefCode(
      req.$credential.account._id,
      body.refCode
    );

    if (
      !otp ||
      !otp.isValid() ||
      otp.action !== OtpObjective.VerifyMobile ||
      !otp.isVerify
    ) {
      logger.error(`Invalid Ref Code`);
      throw new CastcleException(CastcleStatus.INVLAID_REFCODE);
    }
    logger.log('Get account document and validate guest');
    const account = await this.validateGuestAccount(req.$credential);
    logger.log('Get user document');

    const user = await this.userService.getUserFromCredential(req.$credential);
    if (account && user) {
      logger.log('Update mobile number');
      await this.userService.updateMobile(
        user.id,
        account._id,
        body.countryCode,
        body.mobileNumber
      );
      logger.log('Get update user document');
      const afterUpdateUser = await this.userService.getUserFromCredential(
        req.$credential
      );
      const response = await afterUpdateUser.toUserResponse();
      return response;
    } else throw new CastcleException(CastcleStatus.INVALID_ACCESS_TOKEN);
  }

  /**
   * User {castcleId} sync social media for create new
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {''}
   */
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({
    status: HttpStatus.NO_CONTENT
  })
  @ApiBody({
    type: SocialSyncDto
  })
  @CastleClearCacheAuth(CacheKeyName.SyncSocial)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('syncSocial')
  async syncSocial(@Req() req: CredentialRequest, @Body() body: SocialSyncDto) {
    logger.log(`Start create sync social.`);
    logger.log(JSON.stringify(body));

    logger.log('Validate guest');
    await this.validateGuestAccount(req.$credential);

    const user = await this._getUserFromIdOrCastcleId(body.castcleId, req);
    const userSync = await this.socialSyncService.getSocialSyncByUser(user);
    if (userSync.find((x) => x.provider === body.provider)) {
      logger.error(
        `Duplicate provider : ${body.provider} with social id : ${body.uid}.`
      );
      throw new CastcleException(CastcleStatus.SOCIAL_PROVIDER_IS_EXIST);
    }

    const dupSocialSync = await this.socialSyncService.getAllSocialSyncBySocial(
      body.provider,
      body.uid
    );

    if (dupSocialSync?.length) {
      logger.error(
        `Duplicate provider : ${body.provider} with social id : ${body.uid}.`
      );
      throw new CastcleException(
        CastcleStatus.SOCIAL_PROVIDER_IS_EXIST,
        req.$language
      );
    }

    if (user) {
      logger.log(`create sync data.`);
      await this.socialSyncService.create(user, body);
      return '';
    } else {
      logger.error(`Can't get user data`);
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    }
  }

  /**
   * User {castcleId} sync social media for update social
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {''}
   */
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({
    status: HttpStatus.NO_CONTENT
  })
  @ApiBody({
    type: SocialSyncDto
  })
  @CastleClearCacheAuth(CacheKeyName.SyncSocial)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('syncSocial')
  async updateSyncSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialSyncDto
  ) {
    logger.log(`Start update sync social.`);
    logger.log(JSON.stringify(body));
    const user = await this._getUserFromIdOrCastcleId(body.castcleId, req);
    if (!user) throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
    await this.socialSyncService.update(body, user);
  }

  /**
   * User {castcleId} sync social media for update social
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {''}
   */
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({
    status: HttpStatus.NO_CONTENT
  })
  @ApiBody({
    type: SocialSyncDeleteDto
  })
  @CastleClearCacheAuth(CacheKeyName.SyncSocial)
  @Delete('syncSocial')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSyncSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialSyncDeleteDto
  ) {
    logger.log(`Start delete sync social.`);
    logger.log(JSON.stringify(body));
    const user = await this._getUserFromIdOrCastcleId(body.castcleId, req);
    if (user) {
      await this.socialSyncService.delete(body, user);
    } else throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
  }

  private async validateGuestAccount(credential: CredentialDocument) {
    const account = await this.authService.getAccountFromCredential(credential);
    if (!account || account.isGuest) {
      logger.error(`Forbidden guest account.`);
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
    } else {
      return account;
    }
  }
}
