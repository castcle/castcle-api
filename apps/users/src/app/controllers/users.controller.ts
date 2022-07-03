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
  AdsBoostStatus,
  AdsQuery,
  AdsRequestDto,
  AdsService,
  AdsStatus,
  AnalyticService,
  AuthenticationService,
  CampaignService,
  CampaignType,
  ContentResponse,
  ContentService,
  ContentsResponse,
  Credential,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  DEFAULT_QUERY_OPTIONS,
  ExpansionQuery,
  FollowResponse,
  GetContentsDto,
  GetSearchUsersDto,
  NotificationService,
  NotificationSource,
  NotificationType,
  PageDto,
  PageResponseDto,
  PagesResponse,
  PaginationQuery,
  RankerService,
  ResponseDto,
  SocialPageDto,
  SocialProvider,
  SocialSync,
  SocialSyncDeleteDto,
  SocialSyncDto,
  SocialSyncService,
  SocialSyncServiceV2,
  SortDirection,
  TargetIdParam,
  UpdateMobileDto,
  UpdateUserDto,
  User,
  UserField,
  UserResponseDto,
  UserService,
  UserType,
  createCastcleMeta,
  getRelationship,
  getSocialPrefix,
} from '@castcle-api/database';
import { CacheKeyName, Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Downloader,
  Image,
} from '@castcle-api/utils/aws';
import { FacebookClient } from '@castcle-api/utils/clients';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleController,
  RequestMeta,
  RequestMetadata,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
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
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  DeleteUserDtoV1,
  FollowingQuery,
  GetAirdropBalancesQuery,
  GetAirdropBalancesStatus,
  ReportingDto,
  TargetCastcleDto,
  UserRefereeResponse,
  UserReferrerResponse,
  UserSettingsDto,
} from '../dtos';
import { KeywordPipe } from '../pipes/keyword.pipe';
import { SuggestionService } from '../services/suggestion.service';

@CastcleController({ path: 'users', version: '1.0' })
export class UsersController {
  private logger = new CastLogger(UsersController.name);

  constructor(
    private adsService: AdsService,
    private analyticService: AnalyticService,
    private authService: AuthenticationService,
    private campaignService: CampaignService,
    private contentService: ContentService,
    private socialSyncService: SocialSyncService,
    private suggestionService: SuggestionService,
    private userService: UserService,
    private notifyService: NotificationService,
    private download: Downloader,
    private facebookClient: FacebookClient,
    private rankerService: RankerService,
    private socialSyncServiceV2: SocialSyncServiceV2,
  ) {}

  /**
   * return user document that has same castcleId but check if this request should have access to that user
   * @param {CredentialRequest} credentialRequest
   * @param {User} user
   * @returns {User}
   */
  _validateOwnerAccount = async (
    credentialRequest: CredentialRequest,
    user: User,
  ) => {
    const account = await this.authService.getAccountFromCredential(
      credentialRequest.$credential,
    );
    if (String(user.ownerAccount) !== String(account._id)) {
      throw new CastcleException('FORBIDDEN');
    }
    return user;
  };

  _getUser = async (id: string, credential: Credential) => {
    if (id.toLocaleLowerCase() === 'me') {
      this.logger.log('Get Me User from credential.');
      const me = await this.userService.getUserFromCredential(credential);
      if (!me) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
      return me;
    } else {
      this.logger.log('Get User from param.');
      const user = await this.userService.getByIdOrCastcleId(id);
      if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
      return user;
    }
  };

  _getUserAndViewer = async (id: string, credential: Credential) => {
    if (id.toLocaleLowerCase() === 'me') {
      this.logger.log('Get Me User from credential.');
      const me = await this.userService.getUserFromCredential(credential);
      if (!me) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

      return { user: me, viewer: me };
    } else {
      this.logger.log('Get User from param.');
      const user = await this.userService.getByIdOrCastcleId(id);
      if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

      this.logger.log('Get User from credential.');
      const viewer = await this.userService.getUserFromCredential(credential);

      return { user: user, viewer: viewer };
    }
  };

  _getContentIfExist = async (id: string) => {
    try {
      const content = await this.contentService.getContentFromId(id);
      if (content) return content;
      else throw new CastcleException('REQUEST_URL_NOT_FOUND');
    } catch (e) {
      throw new CastcleException('REQUEST_URL_NOT_FOUND');
    }
  };

  _verifyUpdateCastcleId = (displayIdUpdateAt: Date) => {
    displayIdUpdateAt.setDate(
      displayIdUpdateAt.getDate() + Environment.CASTCLE_ID_ALLOW_UPDATE_DAYS,
    );

    const now = new Date().getTime();
    const blockUpdate = displayIdUpdateAt.getTime();
    return now - blockUpdate >= 0;
  };

  _verifyAdsApprove = async (user: User, adsId: string) => {
    const adsCampaign = await this.adsService.lookupAds(user, adsId);
    if (!adsCampaign || adsCampaign.status !== AdsStatus.Approved) {
      this.logger.log('Ads campaign not found.');
      console.log('Ads campaign not found.');
      throw new CastcleException('FORBIDDEN');
    }
    return adsCampaign;
  };
  /**
   * @deprecated The method should not be used. Please use [POST] /users/me/mentions
   */
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
    limitOption: number = DEFAULT_QUERY_OPTIONS.limit,
  ) {
    const authorizedUser = await this.userService.getUserFromCredential(
      $credential,
    );
    const { pagination, users } = await this.userService.getMentionsFromPublic(
      authorizedUser,
      keyword,
      { page: pageOption, limit: limitOption },
    );

    return {
      message: 'success message',
      payload: users,
      pagination,
    };
  }

  @Get('me/mentions')
  @CastcleAuth(CacheKeyName.Users)
  async getMeMentions(
    @Req() { $credential }: CredentialRequest,
    @Query('keyword', KeywordPipe) keyword: string,
    @Query() userQuery?: ExpansionQuery,
  ) {
    this.logger.log(`Me mentions keyword: ${keyword}`);
    const maxResult = 10;
    const authorizedUser = await this.userService.getUserFromCredential(
      $credential,
    );

    let userMentions = [];
    const followingUser = await this.userService.getMentionsFollowing(
      authorizedUser,
      keyword,
      {
        page: DEFAULT_QUERY_OPTIONS.page,
        limit: DEFAULT_QUERY_OPTIONS.limit,
      },
      userQuery.userFields?.includes(UserField.Relationships),
    );

    if (followingUser.userData.users.length < maxResult) {
      this.logger.log(`Get mention user from public`);
      const { users: publicUser } =
        await this.userService.getMentionsFromPublic(
          authorizedUser,
          keyword,
          {
            page: DEFAULT_QUERY_OPTIONS.page,
            limit: DEFAULT_QUERY_OPTIONS.limit,
          },
          userQuery.userFields?.includes(UserField.Relationships),
          followingUser.followingUserId,
        );
      this.logger.log(`Filter block user.`);
      const resultFilter = publicUser.filter((u) => !u.blocked && !u.blocking);
      this.logger.log(`Merge mention user`);
      userMentions = [...followingUser.userData.users, ...resultFilter];
    } else {
      userMentions = [...followingUser.userData.users];
    }

    return {
      payload:
        userMentions.length > maxResult
          ? userMentions.slice(0, maxResult)
          : userMentions,
    };
  }

  @ApiOkResponse({
    type: UserResponseDto,
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get('me')
  async getMyData(
    @Req() req: CredentialRequest,
    @Query() userQuery?: ExpansionQuery,
  ) {
    const { user, account, balance, authenSocial, syncPage, casts } =
      await this.userService.getUserFromAccountId(
        req.$credential.account._id,
        userQuery?.userFields,
      );

    return await user.toUserResponse({
      balance: balance,
      passwordNotSet: !account.password,
      mobile: account.mobile,
      linkSocial: authenSocial,
      syncSocial: syncPage,
      casts: casts,
    });
  }

  /**
   * @deprecate The method should not be used. Please use [GET] me/pages/sync-social
   * @param {CredentialRequest} req - CredentialRequest
   * @returns
   */
  @CastcleAuth(CacheKeyName.SyncSocial)
  @Get('sync-social')
  async getSyncSocial(@Req() req: CredentialRequest) {
    this.logger.log(`start get all my sync social.`);

    this.logger.log(`Get user.`);
    const pages = await this.userService.getPagesFromCredential(
      req.$credential,
    );

    this.logger.log(`Get social from user.`);
    const social: SocialSync[] = [];
    await Promise.all(
      pages.map(async (x) => {
        const syncData = await this.socialSyncService.getSocialSyncByUser(x);
        social.push(...syncData);
      }),
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

  /**
   * @param {CredentialRequest} req - CredentialRequest
   * @returns
   */
  @CastcleAuth(CacheKeyName.SyncSocial)
  @Get('me/pages/sync-social')
  async getSyncSocialOfArray(@Req() req: CredentialRequest) {
    const pages = await this.userService.getPagesFromCredential(
      req.$credential,
    );
    const socials = await this.socialSyncService.getSocialSyncByUser(...pages);
    if (!socials.length) return { payload: null };

    const socialResponse = socials.map((social) =>
      social.toSocialSyncPayload(),
    );
    return { payload: socialResponse };
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get('search')
  async getSearch(
    @Auth() { user }: Authorizer,
    @Query() getSearchUsersDto: GetSearchUsersDto,
  ) {
    const { users, meta } = await this.userService.getSearchUsers(
      user,
      getSearchUsersDto,
    );

    return ResponseDto.ok({ payload: users, meta });
  }

  @ApiOkResponse({ type: UserResponseDto })
  @CastcleAuth(CacheKeyName.Users)
  @Get(':id')
  async getUserById(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Query() userQuery?: ExpansionQuery,
  ) {
    this.logger.log(`User get ${id}`);
    const authorizedUser = await this.userService.getUserFromCredential(
      req.$credential,
    );
    return this.userService.getById(
      authorizedUser,
      id,
      undefined,
      userQuery?.hasRelationshipExpansion,
      userQuery?.userFields,
    );
  }

  @ApiBody({
    type: UpdateUserDto,
  })
  @ApiOkResponse({
    type: UserResponseDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Put(':id')
  async updateMyData(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ) {
    const user = await this._getUser(id, req.$credential);
    const account = await this.authService.getAccountFromCredential(
      req.$credential,
    );
    if (user) {
      if (String(user.ownerAccount) !== String(req.$credential.account._id))
        throw new CastcleException('FORBIDDEN');
      if (
        body.castcleId &&
        user.displayIdUpdatedAt &&
        !this._verifyUpdateCastcleId(user.displayIdUpdatedAt)
      )
        throw new CastcleException('CHANGE_CASTCLE_ID_FAILED');

      if (body.castcleId) {
        const userExisting = await this.authService.getExistedUserFromCastcleId(
          body.castcleId,
        );
        if (userExisting && userExisting.id !== user.id)
          throw new CastcleException('USER_ID_IS_EXIST');
      }

      const newBody = await this.userService.uploadUserInfo(
        body,
        req.$credential.account._id,
      );
      const afterUpdateUser = await this.userService.updateUser(user, newBody);
      const response = await afterUpdateUser.toUserResponse({
        passwordNotSet: !account?.password,
      });
      return response;
    } else throw new CastcleException('INVALID_ACCESS_TOKEN');
  }

  @ApiResponse({ status: 204 })
  @ApiBody({ type: DeleteUserDtoV1 })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMyData(
    @Auth() { account, user }: Authorizer,
    @Body() { channel, payload: { password } }: DeleteUserDtoV1,
  ) {
    if (!user) throw new CastcleException('INVALID_ACCESS_TOKEN');
    if (!account.password) throw new CastcleException('NO_PASSWORD_SET');

    const isValidChannel = channel === 'email';
    const isPasswordValid = account.verifyPassword(password);

    if (!isValidChannel || !isPasswordValid) {
      throw new CastcleException('INVALID_PASSWORD');
    }

    await this.userService.deactivate(account);
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
    maxResults: number = DEFAULT_CONTENT_QUERY_OPTIONS.maxResults,
  ): Promise<ContentsResponse> {
    const user = await this.userService.getUserFromCredential($credential);

    if (!user) throw new CastcleException('REQUEST_URL_NOT_FOUND');

    const { items: contents } = await this.contentService.getContentsFromUser(
      user.id,
      { sinceId, sortBy, untilId, maxResults },
    );
    return this.contentService.convertContentsToContentsResponse(
      user,
      contents,
    );
  }

  @CastcleBasicAuth()
  @Post('me/advertise')
  async createAds(
    @Auth() { user }: Authorizer,
    @Body() adsRequestDto: AdsRequestDto,
  ) {
    //check if
    const campaign = await this.adsService.createAds(user, adsRequestDto);
    const response = await this.adsService.transformAdsCampaignToAdsResponse(
      campaign,
    );
    return response;
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
    pageOption: number = DEFAULT_QUERY_OPTIONS.page,
  ): Promise<PagesResponse> {
    const user = await this.userService.getUserFromCredential($credential);

    const { users: pages, pagination } = await this.userService.getByCriteria(
      user,
      { ownerAccount: $credential.account._id, type: UserType.PAGE },
      { page: pageOption, sortBy: sortByOption },
      false,
      [UserField.SyncSocial],
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
  async getUserContents(
    @Param('id') id: string,
    @Req() { $credential }: CredentialRequest,
    @Query() getContentsDto: GetContentsDto,
    @Query('sortBy', SortByPipe)
    sortBy = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
  ): Promise<ContentsResponse> {
    const user = await this.userService.getByIdOrCastcleId(id);

    if (!user) throw new CastcleException('REQUEST_URL_NOT_FOUND');

    const requester = await this.userService.getUserFromCredential($credential);
    const { items: contents } = await this.contentService.getContentsFromUser(
      user.id,
      { ...getContentsDto, sortBy },
    );
    return this.contentService.convertContentsToContentsResponse(
      requester,
      contents,
      getContentsDto.hasRelationshipExpansion,
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
    @Body() body: TargetCastcleDto,
  ) {
    const currentUser = await this.userService.findUser(id);
    const followedUser = await this.userService.findUser(body.targetCastcleId);
    if (!currentUser.ownerAccount === req.$credential.account._id)
      throw new CastcleException('FORBIDDEN');
    await this.userService.follow(currentUser, followedUser);
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async following(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Body() body: TargetCastcleDto,
  ) {
    const { user } = await this._getUserAndViewer(id, req.$credential);
    const followedUser = await this.userService.findUser(body.targetCastcleId);

    if (!user.ownerAccount === req.$credential.account._id)
      throw new CastcleException('FORBIDDEN');

    await this.userService.follow(user, followedUser);

    this.notifyService.notifyToUser(
      {
        source:
          followedUser.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Follow,
        profileRef: followedUser._id,
        account: followedUser.ownerAccount,
        read: false,
      },
      followedUser,
      req.$credential.account.preferences.languages[0],
    );
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
    @Body() body: TargetCastcleDto,
  ) {
    const currentUser = await this.userService.findUser(id);
    const followedUser = await this.userService.findUser(body.targetCastcleId);
    if (!currentUser.ownerAccount === req.$credential.account._id)
      throw new CastcleException('FORBIDDEN');
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
    @Param('target_castcle_id') targetCastcleId: string,
  ) {
    const { user } = await this._getUserAndViewer(id, req.$credential);
    const followedUser = await this.userService.findUser(targetCastcleId);
    if (!user.ownerAccount === req.$credential.account._id)
      throw new CastcleException('FORBIDDEN');
    await this.userService.unfollow(user, followedUser);
    return '';
  }

  @ApiOkResponse({
    type: FollowResponse,
  })
  @CastcleAuth(CacheKeyName.Users)
  @Get(':id/followers')
  async getUserFollower(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Query() query: FollowingQuery,
    @Query('sortBy', SortByPipe)
    sortByOption = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
  ): Promise<FollowResponse> {
    this.logger.log(
      `Start get followers ${id}, page query:${JSON.stringify(
        query,
      )}, sort:${JSON.stringify(sortByOption)}, type:${JSON.stringify(
        query.type,
      )}`,
    );
    const { user, viewer } = await this._getUserAndViewer(id, req.$credential);

    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const { users, meta } = await this.userService.getFollowers(
      viewer,
      user,
      query,
      sortByOption,
      query.type,
    );

    return { payload: users, meta };
  }

  @ApiOkResponse({
    type: FollowResponse,
  })
  @Get(':id/following')
  @CastcleAuth(CacheKeyName.Users)
  async getUserFollowing(
    @Param('id') id: string,
    @Req() req: CredentialRequest,
    @Query() query: FollowingQuery,
    @Query('sortBy', SortByPipe)
    sortByOption = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy,
  ): Promise<FollowResponse> {
    this.logger.log(
      `Start get following ${id}, page query:${JSON.stringify(
        query,
      )}, sort:${JSON.stringify(sortByOption)}, type:${JSON.stringify(
        query.type,
      )}`,
    );
    const { user, viewer } = await this._getUserAndViewer(id, req.$credential);
    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const { users, meta } = await this.userService.getFollowing(
      viewer,
      user,
      query,
      sortByOption,
      query.type,
    );
    return { payload: users, meta };
  }

  @Get(':id/blocking')
  @CastcleBasicAuth()
  async getBlockedUsers(
    @Req() req: CredentialRequest,
    @Query() paginationQuery: PaginationQuery,
    @Param('id') requestById: string,
  ) {
    const blockUser = await this._getUser(requestById, req.$credential);
    const { users, meta } = await this.userService.getBlockedUsers(
      blockUser,
      paginationQuery,
    );

    return ResponseDto.ok({ payload: users, meta });
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Post(':id/blocking')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async blockUser(
    @Req() req: CredentialRequest,
    @Body() { targetCastcleId }: TargetCastcleDto,
    @Param('id') requestById: string,
  ) {
    const requestUser = await this._getUser(requestById, req.$credential);
    const authorizedUser = await this._validateOwnerAccount(req, requestUser);
    const blockUser = await this.userService.getByIdOrCastcleId(
      targetCastcleId,
    );

    await this.userService.blockUser(authorizedUser, blockUser);
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Delete(':userId/unblocking/:targetCastcleId')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblockUser(
    @Req() req: CredentialRequest,
    @Param() { userId: requestById, targetCastcleId }: TargetIdParam,
  ) {
    const requestUser = await this._getUser(requestById, req.$credential);
    const authorizedUser = await this._validateOwnerAccount(req, requestUser);
    const unblockUser = await this.userService.getByIdOrCastcleId(
      targetCastcleId,
    );

    await this.userService.unblockUser(authorizedUser, unblockUser);
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Post(':id/reporting')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportUser(
    @Body() { message, targetCastcleId, targetContentId }: ReportingDto,
    @Param('id') reportedById: string,
    @Req() req: CredentialRequest,
  ) {
    const requestUser = await this._getUser(reportedById, req.$credential);
    const authorizedUser = await this._validateOwnerAccount(req, requestUser);

    if (targetCastcleId) {
      const reportedUser = await this.userService.getByIdOrCastcleId(
        targetCastcleId,
      );

      await this.userService.reportUser(authorizedUser, reportedUser, message);
    }

    if (targetContentId) {
      const content = await this.contentService.getContentFromId(
        targetContentId,
      );

      await this.contentService.reportContent(authorizedUser, content, message);
    }
  }

  @ApiBody({ type: UpdateMobileDto })
  @ApiOkResponse({ type: UserResponseDto })
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Put('me/mobile')
  async updateMobile(
    @Auth() { account, user }: Authorizer,
    @Body() { countryCode, mobileNumber, refCode }: UpdateMobileDto,
    @RequestMeta() { ip }: RequestMetadata,
  ) {
    if (account?.isGuest) throw new CastcleException('FORBIDDEN');

    const isMobileNumberDuplicate = await this.authService.getAccountFromMobile(
      mobileNumber,
      countryCode,
    );

    if (isMobileNumberDuplicate) {
      throw new CastcleException('MOBILE_NUMBER_ALREADY_EXISTS');
    }

    const otp = await this.authService.getOtpFromRequestIdRefCode(
      account._id,
      refCode,
    );

    if (!otp?.isValidVerifyMobileOtp())
      throw new CastcleException('INVALID_REF_CODE');
    if (otp.receiver !== countryCode + mobileNumber)
      throw new CastcleException('INVALID_PHONE_NUMBER');

    const isFirstTimeVerification = !user.verified.mobile;

    await this.userService.updateMobile(
      user,
      account._id,
      countryCode,
      mobileNumber,
    );

    await otp.delete();
    await this.analyticService.trackMobileVerification(
      ip,
      account._id,
      countryCode,
      mobileNumber,
    );

    if (isFirstTimeVerification) {
      try {
        await this.campaignService.claimCampaignsAirdrop(
          account._id,
          CampaignType.VERIFY_MOBILE,
        );

        const referral = await this.userService.getReferrer(account._id);

        await this.campaignService.claimCampaignsAirdrop(
          referral.ownerAccount as unknown as string,
          CampaignType.FRIEND_REFERRAL,
        );
      } catch (error: unknown) {
        this.logger.error(error, `updateMobile:claimAirdrop:error`);
      }
    }

    return user.toUserResponse({
      mobile: {
        number: mobileNumber,
        countryCode: countryCode,
      },
    });
  }

  /**
   * User {castcleId} sync social media for create new
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {''}
   */
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
      throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
    }
    if (user?.type === UserType.PEOPLE) {
      this.logger.error(`People User is forbiden.`);
      throw new CastcleException('FORBIDDEN');
    }

    const userSync = await this.socialSyncService.getSocialSyncByUser(user);
    if (userSync.find((x) => x.provider === body.provider)) {
      this.logger.error(
        `Duplicate provider : ${body.provider} with social id : ${body.socialId}.`,
      );
      throw new CastcleException('SOCIAL_PROVIDER_IS_EXIST');
    }

    const dupSocialSync = await this.socialSyncService.getAllSocialSyncBySocial(
      body.provider,
      body.socialId,
    );

    if (dupSocialSync?.length) {
      this.logger.error(
        `Duplicate provider : ${body.provider} with social id : ${body.socialId}.`,
      );
      throw new CastcleException('SOCIAL_PROVIDER_IS_EXIST');
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
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @ApiBody({
    type: SocialSyncDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('sync-social')
  async updateSyncSocial(@Body() body: SocialSyncDto) {
    this.logger.log(`Start update sync social.`);
    this.logger.log(JSON.stringify(body));
    const user = await this.userService.findUser(body.castcleId);
    if (!user) throw new CastcleException('FORBIDDEN');
    await this.socialSyncService.update(body, user);
  }

  /**
   * User {castcleId} sync social media for update social
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {''}
   */
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @ApiBody({
    type: SocialSyncDeleteDto,
  })
  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @Delete('sync-social')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSyncSocial(@Body() body: SocialSyncDeleteDto) {
    this.logger.log(`Start delete sync social.`);
    this.logger.log(JSON.stringify(body));
    const user = await this.userService.findUser(body.castcleId);
    if (user) {
      await this.socialSyncService.delete(body, user);
    } else throw new CastcleException('FORBIDDEN');
  }

  private async validateGuestAccount(credential: Credential) {
    const account = await this.authService.getAccountFromCredential(credential);
    if (!account || account.isGuest) {
      this.logger.error(`Forbidden guest account.`);
      throw new CastcleException('FORBIDDEN');
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
    @Body() body: UserSettingsDto,
  ) {
    this.logger.log(`Start user setting.`);
    this.logger.log(JSON.stringify(body));
    const account = await this.authService.getAccountFromCredential(
      req.$credential,
    );
    if (!body?.preferredLanguages?.length) {
      this.logger.error('Payload is empty.');
      throw new CastcleException('PAYLOAD_TYPE_MISMATCH');
    }

    if (!account || account.isGuest) {
      this.logger.error('Can not get account.');
      throw new CastcleException('FORBIDDEN');
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
  async getReferrer(
    @Param('id') id: string,
    @Req() { $credential }: CredentialRequest,
    @Query() userQuery: ExpansionQuery,
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
        viewer.id,
      );

      this.logger.log('Get User relation status');
      const relationStatus = getRelationship(
        relationships,
        viewer.id,
        userReferrer.id,
        userQuery.hasRelationshipExpansion,
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
  async getReferee(
    @Param('id') id: string,
    @Req() { $credential }: CredentialRequest,
    @Query()
    { hasRelationshipExpansion, maxResults, sinceId, untilId }: PaginationQuery,
  ): Promise<UserRefereeResponse> {
    const { user, viewer } = await this._getUserAndViewer(id, $credential);
    const usersReferrer = await this.userService.getReferee(
      user.ownerAccount,
      maxResults,
      sinceId,
      untilId,
    );

    if (!usersReferrer) return { payload: [], meta: null };

    const userID = usersReferrer.items.map((u) => u.id);
    let response = null;
    this.logger.log('Get User relationship');
    if (hasRelationshipExpansion && viewer) {
      const relationships = await this.userService.getRelationshipData(
        hasRelationshipExpansion,
        userID,
        viewer.id,
      );

      response = await Promise.all(
        usersReferrer.items.map(async (x) => {
          this.logger.log('Get User relation status');
          const relationStatus = getRelationship(
            relationships,
            viewer.id,
            x.id,
            hasRelationshipExpansion,
          );

          this.logger.log('build response with relation');
          return await x.toUserResponse({
            blocked: relationStatus.blocked,
            blocking: relationStatus.blocking,
            followed: relationStatus.followed,
          });
        }),
      );
    } else {
      this.logger.log('build response without relation');
      response = await Promise.all(
        usersReferrer.items.map(async (x) => await x.toUserResponse()),
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
    @Req() req: CredentialRequest,
  ) {
    this.logger.log(`Start recast content id: ${contentId}, user: ${id}`);
    const content = await this._getContentIfExist(contentId);
    const { user } = await this._getUserAndViewer(id, req.$credential);

    const recastContent = await this.contentService.getRecastContent(
      content.id,
      user.id,
    );

    if (recastContent) {
      this.logger.error(`Already recast this content id: ${contentId}.`);
      throw new CastcleException('RECAST_IS_EXIST');
    }

    const userRecast = await this._validateOwnerAccount(req, user);
    const result = await this.contentService.recastContentFromUser(
      content,
      userRecast,
    );
    const feedItem = await this.rankerService.getFeedItem(
      req.$credential.account,
      content,
    );

    if (feedItem) {
      this.suggestionService.seen(
        req.$credential.account,
        feedItem._id,
        req.$credential,
      );
    }
    if (
      String(id) === String(content.author.id) ||
      id === content.author.castcleId
    )
      return;

    const userOwner = await this.userService.getByIdOrCastcleId(
      content.author.id,
    );

    this.notifyService.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Recast,
        contentRef: result.recastContent._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      req.$credential.account.preferences.languages[0],
    );

    return this.contentService.convertContentToContentResponse(
      userRecast,
      result.recastContent,
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
    @Req() req: CredentialRequest,
  ) {
    this.logger.log(
      `Start quotecast content id: ${contentId}, user: ${id}, message: ${message}`,
    );
    const { user } = await this._getUserAndViewer(id, req.$credential);
    const [userQuotecast, content] = await Promise.all([
      this._validateOwnerAccount(req, user),
      this._getContentIfExist(contentId),
    ]);
    const result = await this.contentService.quoteContentFromUser(
      content,
      userQuotecast,
      message,
    );

    const feedItem = await this.rankerService.getFeedItem(
      req.$credential.account,
      content,
    );

    if (feedItem) {
      this.suggestionService.seen(
        req.$credential.account,
        feedItem._id,
        req.$credential,
      );
    }

    if (
      String(id) === String(content.author.id) ||
      id === content.author.castcleId
    )
      return;

    const userOwner = await this.userService.getByIdOrCastcleId(
      content.author.id,
    );
    this.notifyService.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Quote,
        contentRef: result.quoteContent._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      req.$credential.account.preferences.languages[0],
    );

    return this.contentService.convertContentToContentResponse(
      userQuotecast,
      result.quoteContent,
    );
  }

  /**
   * Undo a Recast
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {string} id user id
   * @param {string} sourceContentId original content id
   * @returns {''}
   */
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @CastcleBasicAuth()
  @Delete(':id/recast/:sourceContentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async undoRecast(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Param('sourceContentId') sourceContentId: string,
  ) {
    this.logger.log(`Start delete content id: ${sourceContentId}, user: ${id}`);
    const { user } = await this._getUserAndViewer(id, req.$credential);
    const userDelete = await this._validateOwnerAccount(req, user);
    this.contentService.deleteRecastContentFromOriginalAndAuthor(
      sourceContentId,
      userDelete.id,
    );
  }

  @Get('me/airdrops')
  @CastcleBasicAuth()
  async getMyAirdropBalances(
    @Auth() { account }: Authorizer,
    @Query() { campaignFields, status }: GetAirdropBalancesQuery,
  ) {
    const [campaigns, totalBalance] = await Promise.all([
      this.campaignService.getAirdropBalances(
        account._id,
        status === GetAirdropBalancesStatus.ACTIVE ? new Date() : null,
        campaignFields,
      ),
      this.userService.getBalance({ ownerAccount: account._id } as User),
    ]);

    return ResponseDto.ok({ payload: { totalBalance, campaigns } });
  }

  /**
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {PageDto} body PageDto
   * @returns {} Returning a promise that will be resolved with the page object.
   */
  @ApiBody({
    type: PageDto,
  })
  @ApiResponse({
    status: 201,
    type: PageDto,
  })
  @CastcleBasicAuth()
  @Post('me/pages')
  async createPage(@Req() req: CredentialRequest, @Body() body: PageDto) {
    //check if page name exist
    const authorizedUser = await this.userService.getUserFromCredential(
      req.$credential,
    );
    const namingResult = await this.authService.getExistedUserFromCastcleId(
      body.castcleId,
    );
    if (namingResult) throw new CastcleException('PAGE_IS_EXIST');
    const page = await this.userService.createPageFromCredential(
      req.$credential,
      body,
    );
    return this.userService.getById(authorizedUser, page.id, UserType.PAGE);
  }

  /**
   * @param {string} id id => _id by me, castcleId, _id of users
   * @param {string} contentId field on body is _id of contents
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @returns {}
   */

  @ApiResponse({
    status: 204,
  })
  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Post(':id/likes')
  @HttpCode(204)
  async likeContent(
    @Param('id') id: string,
    @Body('contentId') contentId: string,
    @Req() req: CredentialRequest,
  ) {
    const [content, user] = await Promise.all([
      this._getContentIfExist(contentId),
      this._getUser(id, req.$credential),
    ]);

    if (String(user.ownerAccount) !== String(req.$credential.account._id)) {
      throw new CastcleException('FORBIDDEN');
    }

    const likeContent = await this.contentService.likeContent(content, user);
    if (!likeContent) throw new CastcleException('LIKE_IS_EXIST');

    const feedItem = await this.rankerService.getFeedItem(
      req.$credential.account,
      content,
    );

    if (feedItem) {
      this.suggestionService.seen(
        req.$credential.account,
        feedItem._id,
        req.$credential,
      );
    }

    if (String(user._id) === String(content.author.id)) return;

    const userOwner = await this.userService.getByIdOrCastcleId(
      content.author.id,
    );
    this.notifyService.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Like,
        contentRef: content._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      req.$credential.account.preferences.languages[0],
    );
  }

  /**
   * @param {string} id id => _id by me, castcleId, _id of users
   * @param {string} contentId _id of contents
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @returns {}
   */

  @ApiResponse({
    status: 204,
  })
  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Delete(':id/likes/:source_content_id')
  @HttpCode(204)
  async unLikeContent(
    @Param('id') id: string,
    @Param('source_content_id') contentId: string,
    @Req() req: CredentialRequest,
  ) {
    const content = await this._getContentIfExist(contentId);

    const user = await this._getUser(id, req.$credential);

    if (String(user.ownerAccount) !== String(req.$credential.account._id)) {
      throw new CastcleException('FORBIDDEN');
    }

    await this.contentService.unLikeContent(content, user);

    return '';
  }

  @CastcleBasicAuth()
  @Get('me/advertise')
  async listAds(@Auth() { user }: Authorizer, @Query() adsQuery: AdsQuery) {
    const adsCampaigns = await this.adsService.getListAds(user, adsQuery);
    if (!adsCampaigns) return { payload: null };
    const adsResponses = await Promise.all(
      adsCampaigns.map((adsCampaign) =>
        this.adsService.transformAdsCampaignToAdsResponse(adsCampaign),
      ),
    );
    return ResponseDto.ok({
      payload: adsResponses,
      meta: createCastcleMeta(adsCampaigns),
    });
  }
  /**
   * @param {Authorizer}  account Authorizer that has account from interceptor or passport
   * @param {string} adsId - string
   * @returns response object ads.
   */
  @CastcleBasicAuth()
  @Get('me/advertise/:id')
  async lookupAds(@Auth() { user }: Authorizer, @Param('id') adsId: string) {
    const adsCampaign = await this.adsService.lookupAds(user, adsId);
    if (!adsCampaign) return;
    return this.adsService.transformAdsCampaignToAdsResponse(adsCampaign);
  }

  /**
   * @param {Authorizer} account Authorizer that has credential from interceptor or passport
   * @param {string} adsId id by Ads Campaign
   * @param {AdsRequestDto} adsRequest - AdsRequestDto
   * @returns Nothing
   */

  @CastcleBasicAuth()
  @Put('me/advertise/:id')
  async updateAds(
    @Auth() { user }: Authorizer,
    @Param('id') adsId: string,
    @Body() adsRequest: AdsRequestDto,
  ) {
    const adsCampaign = await this.adsService.lookupAds(user, adsId);
    if (!adsCampaign) {
      throw new CastcleException('FORBIDDEN');
    }
    await this.adsService.updateAdsById(adsId, adsRequest);
  }

  /**
   * @param {Authorizer} account Authorizer that has credential from interceptor or passport
   * @param {string} adsId id by Ads Campaign
   * @param {AdsRequestDto} adsRequest - AdsRequestDto
   * @returns Nothing
   */

  @CastcleBasicAuth()
  @Delete('me/advertise/:id')
  async deleteAds(@Auth() { user }: Authorizer, @Param('id') adsId: string) {
    const adsCampaign = await this.adsService.lookupAds(user, adsId);
    if (!adsCampaign) {
      throw new CastcleException('FORBIDDEN');
    }
    await this.adsService.deleteAdsById(adsId);
  }

  /**
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {string} id id by me, castcleId, _id user
   * @returns {} Returning a promise that will be resolved with the object.
   */

  @CastcleBasicAuth()
  @Get(':id/liked-casts')
  async getLikedCast(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Query()
    { hasRelationshipExpansion, maxResults, sinceId, untilId }: PaginationQuery,
  ) {
    const { user, viewer } = await this._getUserAndViewer(id, req.$credential);
    if (!user) {
      throw new CastcleException('FORBIDDEN');
    }
    if (req.$credential.account.isGuest) {
      if (id === 'me') {
        throw new CastcleException('FORBIDDEN');
      }
    }

    const engagement = await this.contentService.getEngagementFromUser(
      user.id,
      sinceId,
      untilId,
      maxResults,
    );

    if (!engagement.items.length) return { payload: null };

    const content = await this.contentService.getContentAllFromId(
      engagement.items,
    );
    if (!content.length) return { payload: null };

    return await this.contentService.convertContentsToContentsResponse(
      viewer,
      content,
      hasRelationshipExpansion,
      engagement.items,
    );
  }

  /**
   * Create new page with sync social data
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {PageResponseDto[]}
   */
  @ApiBody({
    type: SocialSyncDto,
  })
  @CastcleBasicAuth()
  @Post('me/pages/sync-social')
  async createPageSocial(
    @Req() req: CredentialRequest,
    @Body() body: { payload: SocialSyncDto[] },
  ) {
    this.logger.log(`Start create sync social.`);
    this.logger.log(JSON.stringify(body));

    this.logger.log('Validate guest');
    await this.validateGuestAccount(req.$credential);

    const social: string[] = [];
    await Promise.all(
      body.payload.map(async (syncBody) => {
        let castcleId = '';
        const socialPage = new SocialPageDto();
        if (syncBody.userName && syncBody.displayName) {
          castcleId = syncBody.userName;
          socialPage.displayName = syncBody.displayName;
        } else if (syncBody.userName) {
          castcleId = syncBody.userName;
          socialPage.displayName = syncBody.userName;
        } else if (syncBody.displayName) {
          castcleId = syncBody.displayName;
          socialPage.displayName = syncBody.displayName;
        } else {
          const genId = getSocialPrefix(syncBody.socialId, syncBody.provider);
          castcleId = genId;
          socialPage.displayName = genId;
        }

        this.logger.log('Suggest CastcleId');
        const suggestDisplayId = await this.authService.suggestCastcleId(
          castcleId,
        );
        socialPage.castcleId = suggestDisplayId;

        if (syncBody.avatar) {
          this.logger.log(`download avatar from ${syncBody.avatar}`);
          const imgAvatar = await this.download.getImageFromUrl(
            syncBody.avatar,
          );

          this.logger.log('upload avatar to s3');
          const avatar = await Image.upload(imgAvatar, {
            filename: `page-avatar-${suggestDisplayId}`,
            addTime: true,
            sizes: AVATAR_SIZE_CONFIGS,
            subpath: `page_${suggestDisplayId}`,
          });

          socialPage.avatar = avatar.image;
          this.logger.log('Upload avatar');
        }

        if (syncBody.cover) {
          this.logger.log(`download avatar from ${syncBody.cover}`);
          const imgCover = await this.download.getImageFromUrl(syncBody.cover);

          this.logger.log('upload cover to s3');
          const cover = await Image.upload(imgCover, {
            filename: `page-cover-${suggestDisplayId}`,
            addTime: true,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `page_${suggestDisplayId}`,
          });
          socialPage.cover = cover.image;
          this.logger.log('Suggest Cover');
        }

        socialPage.overview = syncBody.overview;
        if (syncBody.link) {
          socialPage.links = { [syncBody.provider]: syncBody.link };
        }

        this.logger.log('Create new page');
        const page = await this.userService.createPageFromSocial(
          req.$credential.account._id,
          socialPage,
        );
        social.push(page.id);
        this.logger.log('Create sync socail');
        await this.socialSyncServiceV2.sync(page, {
          socialId: syncBody.socialId,
          provider: syncBody.provider,
          userName: syncBody.userName,
          displayName: syncBody.displayName,
          avatar: syncBody.avatar,
          active: (syncBody.active ??= true),
          autoPost: (syncBody.autoPost ??= true),
          authToken: syncBody.authToken,
        });
      }),
    );

    this.logger.log(`get page data.`);
    const user = await this.userService.getUserFromCredential(req.$credential);
    const { users: pages } = await this.userService.getByCriteria(
      user,
      { ownerAccount: req.$credential.account._id, type: UserType.PAGE },
      {
        page: 1,
        limit: 100,
        sortBy: {
          field: 'createdAt',
          type: SortDirection.DESC,
        },
      },
    );

    this.logger.log(`filter only new pages.`);
    const pageResult = pages.filter((item) =>
      social.includes(item.id.toString()),
    );

    const response = await Promise.all(
      pageResult.map(async (page) => {
        const sync = await this.socialSyncService.getSocialSyncByPageId(
          page.id,
        );
        return {
          ...page,
          ...{ socialSyncs: sync.length > 0 ? sync[0] : null },
        };
      }),
    );
    return { payload: response };
  }

  /**
   * @param {Authorizer} user  - Authorizer from interceptor or passport
   * @param {string} socialId - The id of the social sync to update.
   */
  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @Post('me/pages/sync-social/:id/auto-post')
  async updateAutoPost(
    @Auth() { credential }: Authorizer,
    @Param('id') id: string,
  ) {
    const user = await this.userService.getUserFromCredential(credential);
    if (!user) throw new CastcleException('FORBIDDEN');

    const social = await this.socialSyncService.getSocialSyncBySocialId(id);
    if (!social) throw new CastcleException('FORBIDDEN');

    const page = await this.socialSyncService.getPageByPageIdAndAccountId(
      social,
      user,
    );
    if (!page) throw new CastcleException('FORBIDDEN');

    await this.socialSyncService.updateAutoPostBySocialId(social, true);
  }

  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @Delete('me/pages/sync-social/:id/auto-post')
  async deleteAutoPost(
    @Auth() { credential }: Authorizer,
    @Param('id') id: string,
  ) {
    const user = await this.userService.getUserFromCredential(credential);
    if (!user) throw new CastcleException('FORBIDDEN');

    const social = await this.socialSyncService.getSocialSyncBySocialId(id);
    if (!social) throw new CastcleException('FORBIDDEN');

    const page = await this.socialSyncService.getPageByPageIdAndAccountId(
      social,
      user,
    );
    if (!page) throw new CastcleException('FORBIDDEN');

    await this.socialSyncService.updateAutoPostBySocialId(social, false);
  }

  /**
   * Reconnect sync social data
   * @param {Authorizer} req Request that has credential from interceptor or passport
   * @param {string} id social sync _id
   * @param {SocialSyncDto} body social sync payload
   * @returns
   */
  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @Post('me/pages/sync-social/:id/connect')
  async connectSyncSocial(
    @Auth() { credential, user }: Authorizer,
    @Param('id') id: string,
    @Body('payload') syncBody: SocialSyncDto,
  ) {
    this.logger.log(`Start reconnect sync social.`);
    await this.validateGuestAccount(credential);

    const social = await this.socialSyncService.getSocialSyncBySocialId(id);
    if (!social) throw new CastcleException('FORBIDDEN');

    const page = await this.socialSyncService.getPageByPageIdAndAccountId(
      social,
      user,
    );
    if (!page) throw new CastcleException('FORBIDDEN');

    const socialPage = new SocialPageDto();

    syncBody.provider = social.provider;
    syncBody.castcleId = page.displayId;
    syncBody.autoPost = true;
    syncBody.active = true;

    if (syncBody.displayName) socialPage.displayName = syncBody.displayName;
    if (syncBody.overview) socialPage.overview = syncBody.overview;

    if (syncBody.avatar) {
      const imageAvatar = await this.download.getImageFromUrl(syncBody.avatar);
      const { image } = await Image.upload(imageAvatar, {
        filename: `page-avatar-${syncBody.castcleId}`,
        addTime: true,
        sizes: AVATAR_SIZE_CONFIGS,
        subpath: `page_${syncBody.castcleId}`,
      });
      socialPage.avatar = image;
    }

    if (syncBody.cover) {
      const imageAvatar = await this.download.getImageFromUrl(syncBody.cover);
      const { image } = await Image.upload(imageAvatar, {
        filename: `page-cover-${syncBody.castcleId}`,
        addTime: true,
        sizes: COMMON_SIZE_CONFIGS,
        subpath: `page_${syncBody.castcleId}`,
      });
      socialPage.cover = image;
    }

    if (syncBody.link) socialPage.links = { [social.provider]: syncBody.link };

    await Promise.all([
      this.userService.updatePageFromSocial(page, socialPage),
      this.socialSyncService.update(syncBody, page),
    ]);

    if (syncBody.provider === SocialProvider.Facebook) {
      this.logger.log('Subscribed facebook page.');
      await this.facebookClient.subscribed(
        syncBody.authToken || social.authToken,
        syncBody.socialId || social.socialId,
      );
    }
  }

  /**
   * Disconnect sync social data
   * @param {Authorizer} req Request that has credential from interceptor or passport
   * @param {string} id social sync _id
   * @returns
   */
  @CastcleClearCacheAuth(CacheKeyName.SyncSocial)
  @Delete('me/pages/sync-social/:id/connect')
  async disconnectSyncSocial(
    @Auth() { credential, user }: Authorizer,
    @Param('id') id: string,
  ) {
    this.logger.log(`Start create sync social.`);

    await this.validateGuestAccount(credential);

    const social = await this.socialSyncService.getSocialSyncBySocialId(id);
    if (!social) throw new CastcleException('FORBIDDEN');

    const page = await this.socialSyncService.getPageByPageIdAndAccountId(
      social,
      user,
    );

    if (!page) throw new CastcleException('FORBIDDEN');
    await this.socialSyncService.disconnect(social, page, true);

    if (social.provider === SocialProvider.Facebook && social.authToken) {
      this.logger.log('Unsubscribed facebook page');
      await this.facebookClient.unsubscribed(social.authToken, social.socialId);
    }
  }

  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  @CastcleBasicAuth()
  @Post('me/advertise/:id/running')
  async adsRunning(
    @Auth() { user, credential }: Authorizer,
    @Param('id') adsId: string,
  ) {
    this.logger.log(`Start running ads.`);
    await this.validateGuestAccount(credential);
    const adsCampaign = await this._verifyAdsApprove(user, adsId);

    if (adsCampaign.boostStatus !== AdsBoostStatus.Pause) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('ADS_BOOST_STATUS_MISMATCH');
    }

    await this.adsService.updateAdsBoostStatus(
      adsCampaign._id,
      AdsBoostStatus.Running,
    );
  }

  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  @CastcleBasicAuth()
  @Post('me/advertise/:id/pause')
  async adsPause(
    @Auth() { credential, user }: Authorizer,
    @Param('id') adsId: string,
  ) {
    this.logger.log(`Start pause ads.`);
    await this.validateGuestAccount(credential);
    const adsCampaign = await this._verifyAdsApprove(user, adsId);

    if (adsCampaign.boostStatus !== AdsBoostStatus.Running) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('ADS_BOOST_STATUS_MISMATCH');
    }

    await this.adsService.updateAdsBoostStatus(
      adsCampaign._id,
      AdsBoostStatus.Pause,
    );
  }

  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  @CastcleBasicAuth()
  @Post('me/advertise/:id/end')
  async adsEnd(
    @Auth() { credential, user }: Authorizer,
    @Param('id') adsId: string,
  ) {
    this.logger.log(`Start end ads.`);
    await this.validateGuestAccount(credential);
    const adsCampaign = await this._verifyAdsApprove(user, adsId);

    if (
      !(
        adsCampaign.boostStatus === AdsBoostStatus.Running ||
        adsCampaign.boostStatus === AdsBoostStatus.Pause
      )
    ) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('ADS_BOOST_STATUS_MISMATCH');
    }

    await this.adsService.updateAdsBoostStatus(
      adsCampaign._id,
      AdsBoostStatus.End,
    );
  }
}
