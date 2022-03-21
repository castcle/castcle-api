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

import { Action, CaslAbilityFactory } from '@castcle-api/casl';
import {
  ContentService,
  NotificationService,
  UserService,
} from '@castcle-api/database';
import {
  ContentResponse,
  ContentsResponse,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  ExpansionQuery,
  GetContentsDto,
  Meta,
  NotificationSource,
  NotificationType,
  PaginationQuery,
  ResponseDto,
  SaveContentDto,
} from '@castcle-api/database/dtos';
import { Content, User, UserType } from '@castcle-api/database/schemas';
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
import { SortByPipe } from '@castcle-api/utils/pipes';
import {
  Body,
  Controller,
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
import { ApiBody, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { ContentLikeBody } from '../dtos/content.dto';
import { AppService } from './app.service';
import { UserRecastedResponse } from './dtos';
import { UserLikingResponse } from './dtos/like.dto';
import { SaveContentPipe } from './pipes/save-content.pipe';

@CastcleController('1.0')
@UsePipes(new ValidationPipe({ skipMissingProperties: true }))
@Controller()
export class ContentController {
  private logger = new CastLogger(ContentController.name);
  constructor(
    private readonly appService: AppService,
    private userService: UserService,
    private contentService: ContentService,
    private caslAbility: CaslAbilityFactory,
    private notifyService: NotificationService
  ) {}

  @ApiBody({ type: SaveContentDto })
  @ApiResponse({ status: HttpStatus.CREATED, type: ContentResponse })
  @CastcleBasicAuth()
  @Post('feed')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async createFeedContent(
    @Body(new SaveContentPipe()) body: SaveContentDto,
    @Query() { hasRelationshipExpansion }: ExpansionQuery,
    @Req() req: CredentialRequest
  ) {
    const ability = this.caslAbility.createForCredential(req.$credential);

    if (!ability.can(Action.Create, Content)) throw CastcleException.FORBIDDEN;

    const user = await this.userService.getByIdOrCastcleId(body.castcleId);
    const authorizedUser = await this.userService.getUserFromCredential(
      req.$credential
    );

    if (String(user.ownerAccount) !== String(authorizedUser.ownerAccount)) {
      throw CastcleException.FORBIDDEN;
    }

    const uploadedBody = await this.appService.uploadContentToS3(body, user);
    const content = await this.contentService.createContentFromUser(
      user,
      uploadedBody
    );

    return this.contentService.convertContentToContentResponse(
      authorizedUser,
      content,
      [],
      hasRelationshipExpansion
    );
  }

  @ApiOkResponse({ type: ContentResponse })
  @CastcleAuth(CacheKeyName.Contents)
  @Get(':id')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getContentFromId(
    @Param('id') id: string,
    @Query() { hasRelationshipExpansion }: ExpansionQuery,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);
    const user = await this.userService.getUserFromCredential(req.$credential);
    const engagements =
      await this.contentService.getAllEngagementFromContentAndUser(
        content,
        user
      );

    return this.contentService.convertContentToContentResponse(
      user,
      content,
      engagements,
      hasRelationshipExpansion
    );
  }

  //TO BE REMOVED !!! this should be check at interceptor or guards
  async _getContentIfExist(id: string, req: CredentialRequest) {
    try {
      const content = await this.contentService.getContentFromId(id);
      if (content) return content;
      else
        throw new CastcleException(
          CastcleStatus.REQUEST_URL_NOT_FOUND,
          req.$language
        );
    } catch (e) {
      throw new CastcleException(
        CastcleStatus.REQUEST_URL_NOT_FOUND,
        req.$language
      );
    }
  }

  async _checkPermissionForUpdate(content: Content, req: CredentialRequest) {
    if (
      req.$credential.account.isGuest ||
      !req.$credential.account.activateDate
    )
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    const users = await this.userService.getUserAndPagesFromCredential(
      req.$credential
    );
    console.log('caslUser', users as User[]);
    const ability = this.caslAbility.getUserManageContentAbility(
      users,
      content
    );
    const result = ability.can(Action.Update, Content);
    console.log('result', result);
    /*const result = this.contentService.checkUserPermissionForEditContent(
      user,
      content
    );*/
    if (result) return true;
    else
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
  }

  @ApiBody({ type: SaveContentDto })
  @ApiOkResponse({ type: ContentResponse })
  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Put(':id')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async updateContentFromId(
    @Body(new SaveContentPipe()) body: SaveContentDto,
    @Param('id') id: string,
    @Query() { hasRelationshipExpansion }: ExpansionQuery,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);

    await this._checkPermissionForUpdate(content, req);

    const user = await this.userService.getUserFromCredential(req.$credential);
    const newBody = await this.appService.uploadContentToS3(body, user);

    const updatedContent = await this.contentService.updateContentFromId(
      content._id,
      newBody
    );

    return this.contentService.convertContentToContentResponse(
      user,
      updatedContent,
      [],
      hasRelationshipExpansion
    );
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteContentFromId(
    @Param('id') id: string,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);

    await this._checkPermissionForUpdate(content, req);
    await this.contentService.deleteContentFromId(content._id);
  }

  @ApiOkResponse({ type: ContentResponse })
  @CastcleAuth(CacheKeyName.Contents)
  @Get()
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getContents(
    @Req() { $credential }: CredentialRequest,
    @Query() { hasRelationshipExpansion, ...getContentsDto }: GetContentsDto,
    @Query('sortBy', SortByPipe)
    sortByOption = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy
  ): Promise<ContentsResponse> {
    const user = await this.userService.getUserFromCredential($credential);
    const { items: contents } = await this.contentService.getContentsForAdmin({
      ...getContentsDto,
      sortBy: sortByOption,
    });

    return this.contentService.convertContentsToContentsResponse(
      user,
      contents,
      hasRelationshipExpansion
    );
  }

  /**
   * @deprecated The method should not be used. Please use [POST] users/:id/liked
   * @param {string} id id => _id by contents
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {UserSettingsDto} body setting dto payload
   * @returns {}
   */

  @ApiResponse({
    status: 204,
  })
  @ApiBody({
    type: ContentLikeBody,
  })
  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Put(':id/liked')
  @HttpCode(204)
  async likeContent(
    @Param('id') id: string,
    @Body('castcleId') castcleId: string,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);
    const user = await this.appService.getUserFromBody(req, castcleId);
    await this.contentService.likeContent(content, user);

    if (user.id === castcleId) return;

    const userOwner = await this.userService.getByIdOrCastcleId(
      content.author.id
    );
    this.notifyService.notifyToUser(
      {
        source:
          userOwner.type === UserType.People
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Like,
        targetRef: { _id: content._id },
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      req.$language
    );
  }
  /**
   * @deprecated The method should not be used. Please use [DEL] users/:id/likes/:source_content_id
   * @param {string} id id => _id by contents
   * @param {CredentialRequest} req Request that has credential from interceptor or passport
   * @param {UserSettingsDto} body setting dto payload
   * @returns {}
   */

  @ApiResponse({
    status: 204,
  })
  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Put(':id/unliked')
  @HttpCode(204)
  async unLikeContent(
    @Param('id') id: string,
    @Body('castcleId') castcleId: string,
    @Req() req: CredentialRequest
  ) {
    //TODO !!! has to add feedItem once implement
    const content = await this._getContentIfExist(id, req);
    const user = await this.appService.getUserFromBody(req, castcleId);
    await this.contentService.unLikeContent(content, user);
    return '';
  }

  /**
   * @deprecated The method should not be used. Please use [POST] users/:id/recast
   */
  @CastcleBasicAuth()
  @ApiResponse({
    status: 201,
    type: ContentResponse,
  })
  @Post(':id/recasted')
  async recastContent(
    @Param('id') id: string,
    @Body('castcleId') castcleId: string,
    @Req() req: CredentialRequest
  ) {
    //TODO !!! has to add feedItem once implement
    const content = await this._getContentIfExist(id, req);
    const user = await this.appService.getUserFromBody(req, castcleId);
    const result = await this.contentService.recastContentFromUser(
      content,
      user
    );
    return {
      payload: result.recastContent.toContentPayloadItem(),
    } as ContentResponse;
  }

  /**
   * @deprecated The method should not be used. Please use [POST] /users/:id/quotecast
   */
  @ApiResponse({
    status: 201,
    type: ContentResponse,
  })
  @CastcleBasicAuth()
  @Post(':id/quotecast')
  async quoteContent(
    @Param('id') id: string,
    @Body('castcleId') castcleId: string,
    @Body('message') message: string,
    @Req() req: CredentialRequest
  ) {
    //TODO !!! has to add feedItem once implement
    const content = await this._getContentIfExist(id, req);

    const user = await this.appService.getUserFromBody(req, castcleId);
    const result = await this.contentService.quoteContentFromUser(
      content,
      user,
      message
    );
    return {
      payload: result.quoteContent.toContentPayloadItem(),
    } as ContentResponse;
  }

  @ApiOkResponse({ type: UserRecastedResponse })
  @CastcleBasicAuth()
  @Get(':id/recasted')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getUserRecasted(
    @Auth() { user }: Authorizer,
    @Param('id') contentId: string,
    @Query()
    { hasRelationshipExpansion, maxResults, sinceId, untilId }: PaginationQuery
  ) {
    this.logger.log(`Get OriginalPost from content : ${contentId}`);
    const contents = await this.contentService.getContentFromOriginalPost(
      contentId,
      maxResults,
      sinceId,
      untilId
    );

    if (!contents?.total) return { payload: [], meta: null };

    const authorIds = contents.items.map((x) => x.author.id);
    const query = { _id: { $in: authorIds } };
    const { users, meta } = await this.userService.getByCriteria(
      user,
      query,
      {},
      hasRelationshipExpansion
    );

    return ResponseDto.ok({ payload: users, meta });
  }
  /**
   * Get the list of users who liked the content
   * @param {CredentialRequest} req - CredentialRequest
   * @param {string} contentId - The id of the content to get the liking from.
   * @param {PaginationQuery}  - req: CredentialRequest
   */

  @ApiOkResponse({ type: UserLikingResponse })
  @CastcleBasicAuth()
  @Get(':id/liking-users')
  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  async getLikingCast(
    @Req() req: CredentialRequest,
    @Param('id') contentId: string,
    @Query()
    { hasRelationshipExpansion, maxResults, sinceId, untilId }: PaginationQuery
  ) {
    this.logger.log(`Get Liking from content : ${contentId}`);

    let response: any = [];
    let relationUser: any = [];
    let relationStatus;

    await this._getContentIfExist(contentId, req);
    const engagement: any = await this.contentService.getLikingCastUser(
      contentId,
      maxResults,
      sinceId,
      untilId
    );
    if (!engagement.items) return { payload: null };

    if (!req.$credential.account.isGuest) {
      const user = await this.userService.getUserAndPagesFromCredential(
        req.$credential
      );
      if (!user) throw CastcleException.FORBIDDEN;

      if (hasRelationshipExpansion && user) {
        this.logger.log('Get User relationship');
        relationUser = engagement.items.map((e) => {
          return e.user.id;
        });
        relationUser = await this.userService.getRelationshipData(
          hasRelationshipExpansion,
          relationUser,
          user[0].id
        );
      }
    }

    for await (const obj of engagement.items) {
      relationStatus = await relationUser.filter(
        (e) => String(e.followedUser) === String(obj.user.id)
      );
      if (relationStatus.length) {
        relationStatus = relationStatus[0];
        if (!relationStatus.blocking) {
          response = [
            ...response,
            await obj.user.toUserResponse({
              blocked: relationStatus.blocking,
              blocking: relationStatus.blocking,
              followed: relationStatus.following,
            }),
          ];
        }
      } else {
        const result = await obj.user.toUserResponse();
        if (hasRelationshipExpansion) {
          result.blocked = false;
          result.blocking = false;
          result.followed = false;
        }
        response = [...response, result];
      }
    }
    return ResponseDto.ok({
      payload: response,
      meta: Meta.fromDocuments(engagement.items),
    });
  }

  @CastcleAuth(CacheKeyName.Contents)
  @Get(':id/participates')
  async getParticipates(
    @Param('id') id: string,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);
    const users = await this.userService.getUserAndPagesFromCredential(
      req.$credential
    );

    const result = await Promise.all(
      users.map(async (user) => {
        const engagements =
          await this.contentService.getAllEngagementFromContentAndUser(
            content,
            user
          );

        const contentResponse =
          await this.contentService.convertContentToContentResponse(
            user,
            content,
            engagements,
            true
          );
        return {
          user: {
            id: user.id,
            castcleId: user.displayId,
            displayName: user.displayName,
            type: user.type,
          },
          participate: contentResponse.payload.participate,
        };
      })
    );
    return { payload: result };
  }
}
