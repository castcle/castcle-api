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
  CampaignService,
  CampaignType,
  ContentService,
  createCastcleMeta,
  getRelationship,
  SocialProvider,
  SocialSyncService,
  TransactionService,
  UserService,
} from '@castcle-api/database';
import {
  ContentResponse,
  ContentsResponse,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  DEFAULT_QUERY_OPTIONS,
  ExpansionQuery,
  FollowResponse,
  GetContentsDto,
  GetSearchUsersDto,
  PageResponseDto,
  PagesResponse,
  PaginationQuery,
  ResponseDto,
  SocialSyncDeleteDto,
  SocialSyncDto,
  UpdateUserDto,
  UserResponseDto,
} from '@castcle-api/database/dtos';
import {
  Credential,
  SocialSync,
  User,
  UserType,
} from '@castcle-api/database/schemas';
import { CastLogger } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleController,
} from '@castcle-api/utils/decorators';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import {
  LimitPipe,
  PagePipe,
  SortByEnum,
  SortByPipe,
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
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { BlockingDto, ReportingDto, UnblockingDto } from './dtos';
import {
  TargetCastcleDto,
  UpdateMobileDto,
  UserRefereeResponse,
  UserReferrerResponse,
  UserSettingsDto,
} from './dtos/dto';
import { KeywordPipe } from './pipes/keyword.pipe';
import { SuggestionService } from './services/suggestion.service';

class DeleteUserBody {
  channel: string;
  payload: {
    password: string;
  };
}

@CastcleController('1.0')
export class UserController {
  private logger = new CastLogger(UserController.name);

  constructor(
    private authService: AuthenticationService,
    private campaignService: CampaignService,
    private contentService: ContentService,
    private socialSyncService: SocialSyncService,
    private transactionService: TransactionService,
    private userService: UserService,
    private suggestionService: SuggestionService
  ) {}

  /**
   * return user document that has same castcleId but check if this request should have access to that user
   * @param {CredentialRequest} credentialRequest
   * @param {User} user
   * @returns {User}
   */
  _validateOwnerAccount = async (
    credentialRequest: CredentialRequest,
    user: User
  ) => {
    const account = await this.authService.getAccountFromCredential(
      credentialRequest.$credential
    );
    if (String(user.ownerAccount) !== String(account._id)) {
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
    }
    return user;
  };

  _getUserAndViewer = async (id: string, credential: Credential) => {
    if (id.toLocaleLowerCase() === 'me') {
      this.logger.log('Get Me User from credential.');
      const me = await this.userService.getUserFromCredential(credential);
      if (!me) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

      return { user: me, viewer: me };
    } else {
      this.logger.log('Get User from param.');
      const user = await this.userService.getByIdOrCastcleId(id);
      if (!user) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

      this.logger.log('Get User from credential.');
      const viewer = await this.userService.getUserFromCredential(credential);

      return { user: user, viewer: viewer };
    }
  };

  _getContentIfExist = async (id: string) => {
    try {
      const content = await this.contentService.getContentFromId(id);
      if (content) return content;
      else throw new CastcleException(CastcleStatus.REQUEST_URL_NOT_FOUND);
    } catch (e) {
      throw new CastcleException(CastcleStatus.REQUEST_URL_NOT_FOUND);
    }
  };

  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'keyword',
    type: String,
    required: true,
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
      pagination,
    };
  }

  @ApiOkResponse({
    type: UserResponseDto,
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get('me')
  async getMyData(@Req() req: CredentialRequest) {
    //UserService
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user && req?.params?.['userFields'] === 'wallet') {
      const balance = await this.transactionService.getUserBalance(user);
      return await user.toUserResponse({
        balance: balance,
      });
    } else if (user) return await user.toUserResponse();
    else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.$language
      );
  }

  @CastcleAuth(CacheKeyName.SyncSocial)
  @Get('sync-social')
  async getSyncSocial(@Req() req: CredentialRequest) {
    this.logger.log(`start get all my sync social.`);

    this.logger.log(`Get user.`);
    const pages = await this.userService.getPagesFromCredential(
      req.$credential
    );

    this.logger.log(`Get social from user.`);
    const social: SocialSync[] = [];
    await Promise.all(
      pages.map(async (x) => {
        const syncData = await this.socialSyncService.getSocialSyncByUser(x);
        social.push(...syncData);
      })
    );

    const response = {};
    this.logger.log(`Generate response.`);
    for (const item in SocialProvider) {
      const data = social.find((x) => x.provider === SocialProvider[item]);
      const key = SocialProvider[item];
      response[key] = data ? data.toSocialSyncPayload() : null;
    }
    return response;
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get('search')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getSearch(
    @Auth() { user }: Authorizer,
    @Query() getSearchUsersDto: GetSearchUsersDto
  ) {
    const { users, meta } = await this.userService.getSearchUsers(
      user,
      getSearchUsersDto
    );

    return ResponseDto.ok({ payload: users, meta });
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
    type: UpdateUserDto,
  })
  @ApiOkResponse({
    type: UserResponseDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Put('me')
  async updateMyData(
    @Req() req: CredentialRequest,
    @Body() body: UpdateUserDto
  ) {
    const user = await this.userService.getUserFromCredential(req.$credential);
    if (user) {
      const newBody = await this.userService.uploadUserInfo(
        body,
        req.$credential.account._id
      );
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
    status: 204,
  })
  @ApiBody({
    type: DeleteUserBody,
  })
  @CastcleClearCacheAuth(CacheKeyName.Users)
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

  @ApiOkResponse({ type: ContentsResponse })
  @ApiQuery({
    name: 'sinceId',
    required: false,
  })
  @ApiQuery({
    name: 'untilId',
    required: false,
  })
  @ApiQuery({
    name: 'maxResults',
    required: false,
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get('me/contents')
  async getMyContents(
    @Req() { $credential }: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortBy = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
    @Query('sinceId') sinceId?: string,
    @Query('untilId') untilId?: string,
    @Query('maxResults', LimitPipe)
    maxResults: number = DEFAULT_CONTENT_QUERY_OPTIONS.maxResults
  ): Promise<ContentsResponse> {
    const user = await this.userService.getUserFromCredential($credential);

    if (!user) throw CastcleException.REQUEST_URL_NOT_FOUND;

    const { items: contents } = await this.contentService.getContentsFromUser(
      user.id,
      { sinceId, sortBy, untilId, maxResults }
    );
    return this.contentService.convertContentsToContentsResponse(
      user,
      contents
    );
  }

  @ApiOkResponse({
    type: PagesResponse,
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get('me/pages')
  async getMyPages(
    @Req() { $credential }: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
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

  @CastcleAuth(CacheKeyName.Users)
  @Get('me/suggestion-follow')
  async suggestToFollow(@Req() { $credential }: CredentialRequest) {
    return this.suggestionService.suggest($credential.account.id);
  }

  @ApiOkResponse({ type: ContentsResponse })
  @ApiQuery({
    name: 'sortBy',
    enum: SortByEnum,
    required: false,
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get(':id/contents')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getUserContents(
    @Param('id') id: string,
    @Req() { $credential }: CredentialRequest,
    @Query() getContentsDto: GetContentsDto,
    @Query('sortBy', SortByPipe)
    sortBy = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy
  ): Promise<ContentsResponse> {
    const user = await this.userService.getByIdOrCastcleId(id, UserType.People);

    if (!user) throw CastcleException.REQUEST_URL_NOT_FOUND;

    const requester = await this.userService.getUserFromCredential($credential);
    const { items: contents } = await this.contentService.getContentsFromUser(
      user.id,
      { ...getContentsDto, sortBy }
    );
    return this.contentService.convertContentsToContentsResponse(
      requester,
      contents,
      getContentsDto.hasRelationshipExpansion
    );
  }

  /**
   * @deprecated The method should not be used. Please use POST instead
   * User {castcleId} follow user from {Id} by
   * @param {string} id idOrCastcleId that user want to follow
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {string} castcleId Body.castcleId
   * @returns {''}
   */
  @ApiResponse({
    status: 204,
  })
  @ApiBody({
    type: TargetCastcleDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Put(':id/following')
  async follow(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Body() body: TargetCastcleDto
  ) {
    const currentUser = await this.userService.findUser(id);
    const followedUser = await this.userService.findUser(body.targetCastcleId);
    if (!currentUser.ownerAccount === req.$credential.account._id)
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    await this.userService.follow(currentUser, followedUser);
    return '';
  }

  /**
   * User {castcleId} follow user from {Id} by
   * @param {string} id idOrCastcleId that user want to follow
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {string} castcleId Body.castcleId
   * @returns {''}
   */
  @ApiResponse({
    status: 204,
  })
  @ApiBody({
    type: TargetCastcleDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Post(':id/following')
  async following(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Body() body: TargetCastcleDto
  ) {
    const { user } = await this._getUserAndViewer(id, req.$credential);
    const followedUser = await this.userService.findUser(body.targetCastcleId);

    if (!user.ownerAccount === req.$credential.account._id)
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    await this.userService.follow(user, followedUser);
    return '';
  }

  /**
   * @deprecated The method should not be used. Please use [DEL] /users/:id/following/:target_castcle_id
   * User {castcleId} unfollow user from {Id} by
   * @param {string} id idOrCastcleId that user want to follow
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {string} castcleId Body.castcleId
   * @returns {''}
   */
  @ApiResponse({
    status: 204,
  })
  @ApiBody({
    type: TargetCastcleDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Put(':id/unfollow')
  async _unfollow(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Body() body: TargetCastcleDto
  ) {
    const currentUser = await this.userService.findUser(id);
    const followedUser = await this.userService.findUser(body.targetCastcleId);
    if (!currentUser.ownerAccount === req.$credential.account._id)
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    await this.userService.unfollow(currentUser, followedUser);
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
    status: 204,
  })
  @ApiBody({
    type: TargetCastcleDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Delete(':id/following/:target_castcle_id')
  async unfollow(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Param('target_castcle_id') targetCastcleId: string
  ) {
    const { user } = await this._getUserAndViewer(id, req.$credential);
    const followedUser = await this.userService.findUser(targetCastcleId);
    if (!user.ownerAccount === req.$credential.account._id)
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    await this.userService.unfollow(user, followedUser);
    return '';
  }

  @ApiOkResponse({
    type: FollowResponse,
  })
  @CastcleAuth(CacheKeyName.Users)
  @ApiQuery({
    name: 'sortBy',
    enum: SortByEnum,
    required: false,
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'type',
    enum: UserType,
    required: false,
  })
  @Get(':id/followers')
  async getUserFollower(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
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
        type: userTypeOption,
      }
    );

    return { pagination, payload: users };
  }

  @ApiOkResponse({
    type: FollowResponse,
  })
  @ApiQuery({
    name: 'sortBy',
    enum: SortByEnum,
    required: false,
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: 'type',
    enum: UserType,
    required: false,
  })
  @Get(':id/following')
  @CastcleAuth(CacheKeyName.Users)
  async getUserFollowing(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
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
        type: userTypeOption,
      }
    );

    return { payload: users, pagination: pagination };
  }

  @Get(':id/blocking')
  @CastcleBasicAuth()
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getBlockedUsers(
    @Auth() authorizer: Authorizer,
    @Query() paginationQuery: PaginationQuery,
    @Param('id') requestById: string
  ) {
    authorizer.requestAccessForUser(requestById);

    const { users, meta } = await this.userService.getBlockedUsers(
      authorizer.user,
      paginationQuery
    );

    return ResponseDto.ok({ payload: users, meta });
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Post(':id/blocking')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async blockUser(
    @Auth() authorizer: Authorizer,
    @Body() { targetCastcleId }: BlockingDto,
    @Param('id') requestById: string
  ) {
    authorizer.requestAccessForUser(requestById);

    const blockUser = await this.userService.getByIdOrCastcleId(
      targetCastcleId
    );

    await this.userService.blockUser(authorizer.user, blockUser);
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Delete(':id/unblocking/:targetCastcleId')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async unblockUser(
    @Auth() authorizer: Authorizer,
    @Param() { id: requestById, targetCastcleId }: UnblockingDto
  ) {
    authorizer.requestAccessForUser(requestById);

    const unblockUser = await this.userService.getByIdOrCastcleId(
      targetCastcleId
    );

    await this.userService.unblockUser(authorizer.user, unblockUser);
  }

  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Post(':id/reporting')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportUser(
    @Body() { message, targetCastcleId, targetContentId }: ReportingDto,
    @Param('id') reportedById: string,
    @Auth() authorizer: Authorizer
  ) {
    authorizer.requestAccessForUser(reportedById);

    if (targetCastcleId) {
      const reportedUser = await this.userService.getByIdOrCastcleId(
        targetCastcleId
      );

      await this.userService.reportUser(authorizer.user, reportedUser, message);
    }

    if (targetContentId) {
      const content = await this.contentService.getContentFromId(
        targetContentId
      );

      await this.contentService.reportContent(
        authorizer.user,
        content,
        message
      );
    }
  }

  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiBody({ type: UpdateMobileDto })
  @ApiOkResponse({ type: UserResponseDto })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Put('me/mobile')
  async updateMobile(
    @Auth() { account, user }: Authorizer,
    @Body() { countryCode, mobileNumber, refCode }: UpdateMobileDto
  ) {
    if (account?.isGuest) throw CastcleException.FORBIDDEN;

    const isMobileNumberDuplicate = await this.authService.getAccountFromMobile(
      mobileNumber,
      countryCode
    );

    if (isMobileNumberDuplicate) {
      throw CastcleException.MOBILE_NUMBER_ALREADY_EXISTS;
    }

    const otp = await this.authService.getOtpFromRequestIdRefCode(
      account._id,
      refCode
    );

    if (!otp?.isValidVerifyMobileOtp()) throw CastcleException.INVALID_REF_CODE;

    const isFirstTimeVerification = !user.verified.mobile;

    await this.userService.updateMobile(
      user,
      account._id,
      countryCode,
      mobileNumber
    );

    if (isFirstTimeVerification) {
      try {
        await this.campaignService.claimCampaignsAirdrop(
          account._id,
          CampaignType.VERIFY_MOBILE
        );

        const referral = await this.userService.getReferrer(account.id);

        await this.campaignService.claimCampaignsAirdrop(
          referral.ownerAccount as unknown as string,
          CampaignType.FRIEND_REFERRAL
        );
      } catch (error: unknown) {
        this.logger.log(
          `#updateMobile:claimAirdrop:error\n${
            error instanceof Error ? error.stack : JSON.stringify(error)
          }`
        );
      }
    }

    return user.toUserResponse();
  }

  /**
   * User {castcleId} sync social media for create new
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {''}
   */
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @ApiBody({
    type: SocialSyncDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('sync-social')
  async syncSocial(@Req() req: CredentialRequest, @Body() body: SocialSyncDto) {
    this.logger.log(`Start create sync social.`);
    this.logger.log(JSON.stringify(body));

    this.logger.log('Validate guest');
    await this.validateGuestAccount(req.$credential);

    const user = await this.userService.findUser(body.castcleId);
    if (!user) {
      this.logger.error(`Can't get user data`);
      throw new CastcleException(CastcleStatus.USER_OR_PAGE_NOT_FOUND);
    }
    if (user?.type === UserType.People) {
      this.logger.error(`People User is forbiden.`);
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
    }

    const userSync = await this.socialSyncService.getSocialSyncByUser(user);
    if (userSync.find((x) => x.provider === body.provider)) {
      this.logger.error(
        `Duplicate provider : ${body.provider} with social id : ${body.socialId}.`
      );
      throw new CastcleException(CastcleStatus.SOCIAL_PROVIDER_IS_EXIST);
    }

    const dupSocialSync = await this.socialSyncService.getAllSocialSyncBySocial(
      body.provider,
      body.socialId
    );

    if (dupSocialSync?.length) {
      this.logger.error(
        `Duplicate provider : ${body.provider} with social id : ${body.socialId}.`
      );
      throw new CastcleException(
        CastcleStatus.SOCIAL_PROVIDER_IS_EXIST,
        req.$language
      );
    }

    this.logger.log(`create sync data.`);
    await this.socialSyncService.create(user, body);
    return '';
  }

  /**
   * User {castcleId} sync social media for update social
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {''}
   */
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @ApiBody({
    type: SocialSyncDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('sync-social')
  async updateSyncSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialSyncDto
  ) {
    this.logger.log(`Start update sync social.`);
    this.logger.log(JSON.stringify(body));
    const user = await this.userService.findUser(body.castcleId);
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
    status: HttpStatus.NO_CONTENT,
  })
  @ApiBody({
    type: SocialSyncDeleteDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @Delete('sync-social')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSyncSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialSyncDeleteDto
  ) {
    this.logger.log(`Start delete sync social.`);
    this.logger.log(JSON.stringify(body));
    const user = await this.userService.findUser(body.castcleId);
    if (user) {
      await this.socialSyncService.delete(body, user);
    } else throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
  }

  private async validateGuestAccount(credential: Credential) {
    const account = await this.authService.getAccountFromCredential(credential);
    if (!account || account.isGuest) {
      this.logger.error(`Forbidden guest account.`);
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
    } else {
      return account;
    }
  }

  /**
   * Update setting to account
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {UserSettingsDto} body setting dto payload
   * @returns {''}
   */
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @ApiBody({
    type: UserSettingsDto,
  })
  @CastcleBasicAuth()
  @Put('settings')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateUserSettings(
    @Req() req: CredentialRequest,
    @Body() body: UserSettingsDto
  ) {
    this.logger.log(`Start user setting.`);
    this.logger.log(JSON.stringify(body));
    const account = await this.authService.getAccountFromCredential(
      req.$credential
    );
    if (!body?.preferredLanguages?.length) {
      this.logger.error('Payload is empty.');
      throw new CastcleException(CastcleStatus.PAYLOAD_TYPE_MISMATCH);
    }

    if (!account || account.isGuest) {
      this.logger.error('Can not get account.');
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
    }

    await this.userService.userSettings(account.id, body.preferredLanguages);
  }

  /**
   *
   * @param {string} idOrCastcleId of page
   * @param {CredentialRequest} req that contain current user credential
   * @param {string[]} userFields Available values : relationships
   * @returns {Promise<UserReferrerResponse>} referrer user
   */
  @ApiOkResponse({
    type: UserReferrerResponse,
  })
  @CastcleAuth(CacheKeyName.Referrer)
  @Get(':id/referrer')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getReferrer(
    @Param('id') id: string,
    @Req() { $credential }: CredentialRequest,
    @Query() userQuery: ExpansionQuery
  ): Promise<UserReferrerResponse> {
    const { user, viewer } = await this._getUserAndViewer(id, $credential);

    const userReferrer = await this.userService.getReferrer(user.ownerAccount);
    if (!userReferrer) return { payload: null };

    let response = null;
    this.logger.log('Get User relationship');
    if (userQuery?.hasRelationshipExpansion && viewer) {
      const relationships = await this.userService.getRelationshipData(
        userQuery.hasRelationshipExpansion,
        userReferrer.id,
        viewer.id
      );

      this.logger.log('Get User relation status');
      const relationStatus = getRelationship(
        relationships,
        viewer.id,
        userReferrer.id,
        userQuery.hasRelationshipExpansion
      );

      this.logger.log('build response');
      response = await userReferrer.toUserResponse({
        blocked: relationStatus.blocked,
        blocking: relationStatus.blocking,
        followed: relationStatus.followed,
      });
    } else {
      this.logger.log('build response');
      response = await userReferrer.toUserResponse();
    }
    return { payload: response };
  }

  /**
   *
   * @param {string} idOrCastcleId of page
   * @param {CredentialRequest} req that contain current user credential
   * @param {string[]} userFields Available values : relationships
   * @param {number} maxResults limit return result
   * @param {string} sinceId Returns results with an ID greater than (that is, more recent than) the specified ID
   * @param {string} untilId Returns results with an ID less less than (that is, older than) the specified ID
   * @returns {Promise<UserRefereeResponse>} all User Referee
   */
  @ApiOkResponse({
    type: UserRefereeResponse,
  })
  @CastcleAuth(CacheKeyName.Referrer)
  @Get(':id/referee')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getReferee(
    @Param('id') id: string,
    @Req() { $credential }: CredentialRequest,
    @Query()
    { hasRelationshipExpansion, maxResults, sinceId, untilId }: PaginationQuery
  ): Promise<UserRefereeResponse> {
    const { user, viewer } = await this._getUserAndViewer(id, $credential);
    const usersReferrer = await this.userService.getReferee(
      user.ownerAccount,
      maxResults,
      sinceId,
      untilId
    );

    if (!usersReferrer) return { payload: [], meta: null };

    const userID = usersReferrer.items.map((u) => u.id);
    let response = null;
    this.logger.log('Get User relationship');
    if (hasRelationshipExpansion && viewer) {
      const relationships = await this.userService.getRelationshipData(
        hasRelationshipExpansion,
        userID,
        viewer.id
      );

      response = await Promise.all(
        usersReferrer.items.map(async (x) => {
          this.logger.log('Get User relation status');
          const relationStatus = getRelationship(
            relationships,
            viewer.id,
            x.id,
            hasRelationshipExpansion
          );

          this.logger.log('build response with relation');
          return await x.toUserResponse({
            blocked: relationStatus.blocked,
            blocking: relationStatus.blocking,
            followed: relationStatus.followed,
          });
        })
      );
    } else {
      this.logger.log('build response without relation');
      response = await Promise.all(
        usersReferrer.items.map(async (x) => await x.toUserResponse())
      );
    }
    const meta = createCastcleMeta(usersReferrer.items, usersReferrer.total);
    return { payload: response, meta: meta };
  }

  @CastcleBasicAuth()
  @ApiResponse({
    status: 201,
    type: ContentResponse,
  })
  @Post(':id/recast')
  async recastContent(
    @Param('id') id: string,
    @Body('contentId') contentId: string,
    @Req() req: CredentialRequest
  ) {
    this.logger.log(`Start recast content id: ${contentId}, user: ${id}`);
    const content = await this._getContentIfExist(contentId);
    const { user } = await this._getUserAndViewer(id, req.$credential);

    const recastContent = await this.contentService.getRecastContent(
      content.id,
      user.id
    );

    if (recastContent) {
      this.logger.error(`Already recast this content id: ${contentId}.`);
      throw new CastcleException(CastcleStatus.RECAST_IS_EXIST);
    }

    const userRecast = await this._validateOwnerAccount(req, user);
    const result = await this.contentService.recastContentFromUser(
      content,
      userRecast
    );

    return this.contentService.convertContentToContentResponse(
      userRecast,
      result.recastContent
    );
  }

  @ApiResponse({
    status: 201,
    type: ContentResponse,
  })
  @CastcleBasicAuth()
  @Post(':id/quotecast')
  async quoteContent(
    @Param('id') id: string,
    @Body('contentId') contentId: string,
    @Body('message') message: string,
    @Req() req: CredentialRequest
  ) {
    this.logger.log(
      `Start quotecast content id: ${contentId}, user: ${id}, message: ${message}`
    );
    const { user } = await this._getUserAndViewer(id, req.$credential);
    const userQuotecast = await this._validateOwnerAccount(req, user);
    const content = await this._getContentIfExist(contentId);
    const result = await this.contentService.quoteContentFromUser(
      content,
      userQuotecast,
      message
    );
    return this.contentService.convertContentToContentResponse(
      userQuotecast,
      result.quoteContent
    );
  }

  /**
   * Undo a Recast
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {string} id user id
   * @param {string} sourceContentId original content id
   * @returns {''}
   */
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @CastcleBasicAuth()
  @Delete(':id/recast/:sourceContentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async undoRecast(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Param('sourceContentId') sourceContentId: string
  ) {
    this.logger.log(`Start delete content id: ${sourceContentId}, user: ${id}`);
    const { user } = await this._getUserAndViewer(id, req.$credential);
    const userDelete = await this._validateOwnerAccount(req, user);
    this.contentService.deleteRecastContentFromOriginalAndAuthor(
      sourceContentId,
      userDelete.id
    );
  }
}
