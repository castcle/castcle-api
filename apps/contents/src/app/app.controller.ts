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
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { AppService } from './app.service';
import {
  AuthenticationService,
  UserService,
  ContentService,
  NotificationService
} from '@castcle-api/database';
import {
  CastcleQueueAction,
  ContentResponse,
  ContentsResponse,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  ExpansionQuery,
  GetContentsDto,
  NotificationSource,
  NotificationType,
  SaveContentDto
} from '@castcle-api/database/dtos';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { ApiBody, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { Content, ContentDocument, User } from '@castcle-api/database/schemas';
import { SortByPipe } from '@castcle-api/utils/pipes';
import { CaslAbilityFactory, Action } from '@castcle-api/casl';
import {
  CastcleAuth,
  CastcleController,
  CastcleBasicAuth,
  CastleClearCacheAuth
} from '@castcle-api/utils/decorators';
import { CacheKeyName } from '@castcle-api/utils/cache';
import { ContentProducer } from '@castcle-api/utils/queue';
import { ContentLikeBody } from '../dtos/content.dto';
import { SaveContentPipe } from './pipes/save-content.pipe';
import { ReportContentDto } from './dtos';

@CastcleController('1.0')
@UsePipes(new ValidationPipe({ skipMissingProperties: true }))
@Controller()
export class ContentController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService,
    private userService: UserService,
    private contentService: ContentService,
    private caslAbility: CaslAbilityFactory,
    private contentProducer: ContentProducer,
    private notifyService: NotificationService
  ) {}

  @ApiBody({ type: SaveContentDto })
  @ApiResponse({ status: HttpStatus.CREATED, type: ContentResponse })
  @CastcleBasicAuth()
  @Post('feed')
  async createFeedContent(
    @Body(new SaveContentPipe()) body: SaveContentDto,
    @Query() expansionQuery: ExpansionQuery,
    @Req() req: CredentialRequest
  ) {
    const ability = this.caslAbility.createForCredential(req.$credential);

    if (!ability.can(Action.Create, Content)) throw CastcleException.FORBIDDEN;

    const user = await this.authService.getUserFromCastcleId(body.castcleId);
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

    this.contentProducer.sendMessage({
      action: CastcleQueueAction.CreateFeedItemToEveryOne,
      id: content._id
    });

    return expansionQuery.hasRelationshipExpansion
      ? this.contentService.convertContentToContentResponse(
          authorizedUser,
          content
        )
      : this.appService.convertContentToContentResponse(content);
  }

  @ApiOkResponse({ type: ContentResponse })
  @CastcleAuth(CacheKeyName.Contents)
  @Get(':id')
  async getContentFromId(
    @Param('id') id: string,
    @Query() expansionQuery: ExpansionQuery,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);
    const user = await this.userService.getUserFromCredential(req.$credential);
    const engagements =
      await this.contentService.getAllEngagementFromContentAndUser(
        content,
        user
      );

    return expansionQuery.hasRelationshipExpansion
      ? this.contentService.convertContentToContentResponse(
          user,
          content,
          engagements
        )
      : this.appService.convertContentToContentResponse(content, engagements);
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

  async _checkPermissionForUpdate(
    content: ContentDocument,
    req: CredentialRequest
  ) {
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
  @CastleClearCacheAuth(CacheKeyName.Contents)
  @Put(':id')
  async updateContentFromId(
    @Body(new SaveContentPipe()) body: SaveContentDto,
    @Param('id') id: string,
    @Query() expansionQuery: ExpansionQuery,
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

    return expansionQuery.hasRelationshipExpansion
      ? this.contentService.convertContentToContentResponse(
          user,
          updatedContent
        )
      : this.appService.convertContentToContentResponse(updatedContent);
  }

  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @CastleClearCacheAuth(CacheKeyName.Contents)
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
  async getContents(
    @Req() { $credential }: CredentialRequest,
    @Query() { hasRelationshipExpansion, ...getContentsDto }: GetContentsDto,
    @Query('sortBy', SortByPipe)
    sortByOption = DEFAULT_CONTENT_QUERY_OPTIONS.sortBy
  ): Promise<ContentsResponse> {
    const user = await this.userService.getUserFromCredential($credential);
    const { items, meta } = await this.contentService.getContentsForAdmin({
      ...getContentsDto,
      sortBy: sortByOption
    });

    return this.contentService.convertContentsToContentResponse(
      user,
      items,
      meta,
      hasRelationshipExpansion
    );
  }

  @ApiResponse({
    status: 204
  })
  @ApiBody({
    type: ContentLikeBody
  })
  @CastleClearCacheAuth(CacheKeyName.Contents)
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
    //TODO !!! has to implement message libs and i18N and message functions
    this.notifyService.notifyToUser({
      type: NotificationType.Content,
      message: `${user.displayName} ถูกใจโพสของคุณ`,
      read: false,
      source: NotificationSource.Profile,
      sourceUserId: user._id,
      targetRef: {
        _id: content._id
      },
      account: { _id: content.author.id }
    });
    return '';
  }

  @ApiResponse({
    status: 204
  })
  @CastleClearCacheAuth(CacheKeyName.Contents)
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

  @CastcleBasicAuth()
  @ApiResponse({
    status: 201,
    type: ContentResponse
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
      payload: result.recastContent.toContentPayloadItem()
    } as ContentResponse;
  }

  @ApiResponse({
    status: 201,
    type: ContentResponse
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
      payload: result.quoteContent.toContentPayloadItem()
    } as ContentResponse;
  }

  @UsePipes(new ValidationPipe({ skipMissingProperties: true }))
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @Post(':id/reporting')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportContent(
    @Body() { message }: ReportContentDto,
    @Param('id') reportingContentId: string,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(reportingContentId, req);
    const user = await this.userService.getUserFromCredential(req.$credential);

    await this.contentService.reportContent(user, content, message);
  }
}
