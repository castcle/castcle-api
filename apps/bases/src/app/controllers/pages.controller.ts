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
  getSocialProfix,
  SocialSyncService,
  UserService,
} from '@castcle-api/database';
import {
  ContentResponse,
  ContentsResponse,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  DEFAULT_QUERY_OPTIONS,
  GetContentsDto,
  PageDto,
  PageResponseDto,
  PagesResponse,
  SocialPageDto,
  SocialSyncPageRequestDto,
  SortDirection,
  UpdatePageDto,
} from '@castcle-api/database/dtos';
import { Credential, UserType } from '@castcle-api/database/schemas';
import { CastLogger } from '@castcle-api/logger';
import {
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Image,
  ImageUploadOptions,
} from '@castcle-api/utils/aws';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
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
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { DeletePageDto } from '../dtos/delete.page.dto';

@CastcleController('1.0')
@Controller()
export class PagesController {
  private logger = new CastLogger(PagesController.name);

  constructor(
    private authService: AuthenticationService,
    private userService: UserService,
    private contentService: ContentService,
    private socialSyncService: SocialSyncService
  ) {}

  _uploadImage = (base64: string, options?: ImageUploadOptions) =>
    Image.upload(base64, options);

  _getOwnPageByIdOrCastcleId = async (
    idOrCastCleId: string,
    req: CredentialRequest
  ) => {
    const idResult = await this.userService.getByIdOrCastcleId(idOrCastCleId);
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
    const castcleIdResult = await this.userService.getByIdOrCastcleId(
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
    type: PageDto,
  })
  @ApiResponse({
    status: 201,
    type: PageDto,
  })
  @CastcleBasicAuth()
  @Post('pages')
  async createPage(@Req() req: CredentialRequest, @Body() body: PageDto) {
    console.debug('create body', body);
    //check if page name exist
    const authorizedUser = await this.userService.getUserFromCredential(
      req.$credential
    );
    const namingResult = await this.authService.getExistedUserFromCastcleId(
      body.castcleId
    );
    if (namingResult)
      throw new CastcleException(CastcleStatus.PAGE_IS_EXIST, req.$language);

    const page = await this.userService.createPageFromCredential(
      req.$credential,
      body
    );

    return this.userService.getById(authorizedUser, page.id, UserType.Page);
  }

  @ApiBody({
    type: UpdatePageDto,
  })
  @ApiResponse({
    status: 201,
    type: PageDto,
  })
  @HttpCode(201)
  @CastcleClearCacheAuth(CacheKeyName.Pages)
  @Put('pages/:id')
  async updatePage(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Body() body: UpdatePageDto
  ) {
    //check if page name exist
    const page = await this._getOwnPageByIdOrCastcleId(id, req);
    console.debug('updatePage', page);
    if (!page.profile) page.profile = {};
    if (!page.profile.images) page.profile.images = {};
    if (!page.profile.socials) page.profile.socials = {};

    //TODO !!! performance issue
    if (body.images && body.images.avatar)
      page.profile.images.avatar = (
        await this._uploadImage(body.images.avatar, {
          filename: `page-avatar-${id}`,
          sizes: AVATAR_SIZE_CONFIGS,
          subpath: `page_${page.displayId}`,
        })
      ).image;
    if (body.images && body.images.cover)
      page.profile.images.cover = (
        await this._uploadImage(body.images.cover, {
          filename: `page-cover-${id}`,
          sizes: COMMON_SIZE_CONFIGS,
          subpath: `page_${page.displayId}`,
        })
      ).image;
    if (body.displayName) page.displayName = body.displayName;
    if (body.overview) page.profile.overview = body.overview;
    if (body.links) {
      if (body.links.facebook)
        page.profile.socials.facebook = body.links.facebook;
      if (body.links.medium) page.profile.socials.medium = body.links.medium;
      if (body.links.twitter) page.profile.socials.twitter = body.links.twitter;
      if (body.links.youtube) page.profile.socials.youtube = body.links.youtube;
      if (body.links.website)
        page.profile.websites = [
          { website: body.links.website, detail: body.links.website },
        ];
    }
    console.debug('preUpdatePage', page);
    page.markModified('profile');
    await page.save();

    const authorizedUser = await this.userService.getUserFromCredential(
      req.$credential
    );
    return this.userService.getById(authorizedUser, id, UserType.Page);
  }

  @ApiOkResponse({ type: PageResponseDto })
  @CastcleAuth(CacheKeyName.Pages)
  @Get('pages/:id')
  async getPageFromId(
    @Req() { $credential }: CredentialRequest,
    @Param('id') id: string
  ) {
    const authorizedUser = await this.userService.getUserFromCredential(
      $credential
    );

    return this.userService.getById(authorizedUser, id, UserType.Page);
  }

  @ApiOkResponse({ type: PagesResponse })
  @CastcleAuth(CacheKeyName.Pages)
  @Get('pages')
  async getAllPages(
    @Req() { $credential }: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortBy = DEFAULT_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    page: number = DEFAULT_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limit: number = DEFAULT_QUERY_OPTIONS.limit
  ): Promise<PagesResponse> {
    const authorizedUser = await this.userService.getUserFromCredential(
      $credential
    );
    const { users: pages, pagination } = await this.userService.getByCriteria(
      authorizedUser,
      { type: UserType.Page },
      { page, sortBy, limit }
    );

    return { payload: pages as PageResponseDto[], pagination };
  }

  @ApiResponse({
    status: 204,
  })
  @HttpCode(204)
  @CastcleClearCacheAuth(CacheKeyName.Pages)
  @Delete('pages/:id')
  async deletePage(
    @Req() req: CredentialRequest,
    @Param('id') id: string,
    @Body() deletePageDto: DeletePageDto
  ) {
    try {
      const page = await this._getOwnPageByIdOrCastcleId(id, req);
      //TODO !!! need guard later on
      const password = deletePageDto.password;
      const account = await this.authService.getAccountFromCredential(
        req.$credential
      );
      if (!(await account.verifyPassword(password))) {
        throw new CastcleException(
          CastcleStatus.INVALID_PASSWORD,
          req.$language
        );
      }
      if (String(page.ownerAccount) === String(req.$credential.account._id)) {
        await this.userService.deleteUserFromId(page._id);
        //await page.delete();
        return '';
      } else
        throw new CastcleException(
          CastcleStatus.FORBIDDEN_REQUEST,
          req.$language
        );
    } catch (e) {
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    }
  }

  /**
   *
   * @param {string} idOrCastcleId of page
   * @param {CredentialRequest} req that contain current user credential
   * @returns {Promise<ContentsResponse>} all contents that has been map with contentService.getContentsFromUser()
   */

  @ApiOkResponse({ type: ContentResponse })
  @CastcleAuth(CacheKeyName.Pages)
  @ApiQuery({
    name: 'sortBy',
    enum: SortByEnum,
    required: false,
  })
  @Get('pages/:id/contents')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getPageContents(
    @Param('id') id: string,
    @Req() { $credential }: CredentialRequest,
    @Query() getContentsDto: GetContentsDto,
    @Query('sortBy', SortByPipe)
    sortBy = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy
  ): Promise<ContentsResponse> {
    const page = await this.userService.getByIdOrCastcleId(id, UserType.Page);

    if (!page) throw CastcleException.REQUEST_URL_NOT_FOUND;

    const requester = await this.userService.getUserFromCredential($credential);
    const { items: contents } = await this.contentService.getContentsFromUser(
      page.id,
      { ...getContentsDto, sortBy }
    );

    return this.contentService.convertContentsToContentsResponse(
      requester,
      contents,
      getContentsDto.hasRelationshipExpansion
    );
  }

  /**
   * Create new page with sync social data
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {SocialSyncDto} body social sync payload
   * @returns {PageResponseDto[]}
   */
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiBody({
    type: SocialSyncPageRequestDto,
  })
  @CastcleBasicAuth()
  @Post('page/social')
  async createPageSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialSyncPageRequestDto
  ) {
    this.logger.log(`Start create sync social.`);
    this.logger.log(JSON.stringify(body));

    this.logger.log('Validate guest');
    await this.validateGuestAccount(req.$credential);

    this.logger.log('Validate dupplicate social');
    await Promise.all(
      body.payload.map(async (socialSync) => {
        const dupSocialSync =
          await this.socialSyncService.getAllSocialSyncBySocial(
            socialSync.provider,
            socialSync.socialId
          );

        if (dupSocialSync?.length) {
          this.logger.error(
            `Duplicate provider : ${socialSync.provider} with social id : ${socialSync.socialId}.`
          );
          throw new CastcleException(CastcleStatus.SOCIAL_PROVIDER_IS_EXIST);
        }
      })
    );

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
          const genId = getSocialProfix(syncBody.socialId, syncBody.provider);
          castcleId = genId;
          socialPage.displayName = genId;
        }

        this.logger.log('Suggest CastcleId');
        const sugguestDisplayId = await this.authService.suggestCastcleId(
          castcleId
        );
        socialPage.castcleId = sugguestDisplayId;

        if (syncBody.avatar) {
          const avatar = await Image.upload(syncBody.avatar as string, {
            filename: `avatar-${req.$credential.account._id}`,
            addTime: true,
            sizes: AVATAR_SIZE_CONFIGS,
            subpath: `account_${req.$credential.account._id}`,
          });
          socialPage.avatar = avatar.image;
          this.logger.log('Upload avatar');
        }

        if (syncBody.cover) {
          const cover = await Image.upload(syncBody.cover as string, {
            filename: `cover-${req.$credential.account._id}`,
            addTime: true,
            sizes: COMMON_SIZE_CONFIGS,
            subpath: `account_${req.$credential.account._id}`,
          });
          socialPage.cover = cover.image;
          this.logger.log('Suggest Cover');
        }

        socialPage.overview = syncBody.overview;
        if (syncBody.link) {
          socialPage.links = { [syncBody.provider]: syncBody.link };
        }
        socialPage.socialSyncs = true;
        this.logger.log('Create new page');
        const page = await this.userService.createPageFromSocial(
          req.$credential.account._id,
          socialPage
        );
        social.push(page.id);
        this.logger.log('Create sync socail');
        this.socialSyncService.create(page, syncBody);
      })
    );

    this.logger.log(`get page data.`);
    const user = await this.userService.getUserFromCredential(req.$credential);
    const { users: pages } = await this.userService.getByCriteria(
      user,
      { ownerAccount: req.$credential.account._id, type: UserType.Page },
      {
        page: 1,
        sortBy: {
          field: 'createdAt',
          type: SortDirection.DESC,
        },
      }
    );

    this.logger.log(`filter only new pages.`);
    const result = pages.filter((item) => social.includes(item.id.toString()));
    return { payload: result as PageResponseDto[] };
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
}
