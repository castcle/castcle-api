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
  Query,
  Req
} from '@nestjs/common';
import { AppService } from './app.service';
import {
  AuthenticationService,
  UserService,
  ContentService
} from '@castcle-api/database';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import {
  CastcleQueueAction,
  ContentResponse,
  ContentsResponse,
  ContentType,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  SaveContentDto
} from '@castcle-api/database/dtos';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { ApiBody, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { Content, ContentDocument, User } from '@castcle-api/database/schemas';
import {
  ContentTypePipe,
  LimitPipe,
  PagePipe,
  SortByPipe
} from '@castcle-api/utils/pipes';
import { CaslAbilityFactory, Action } from '@castcle-api/casl';
import {
  CastcleAuth,
  CastcleController,
  CastcleBasicAuth,
  CastleClearCacheAuth
} from '@castcle-api/utils/decorators';
import { CacheKeyName } from '@castcle-api/utils/cache';
import { ContentProducer } from '@castcle-api/utils/queue';

@CastcleController('1.0')
@Controller()
export class ContentController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService,
    private userService: UserService,
    private contentService: ContentService,
    private caslAbility: CaslAbilityFactory,
    private contentProducer: ContentProducer
  ) {}
  private readonly logger = new CastLogger(
    ContentController.name,
    CastLoggerOptions
  );

  @ApiBody({
    type: SaveContentDto
  })
  @ApiResponse({
    status: 201,
    type: ContentResponse
  })
  @CastcleBasicAuth()
  @Post('feed')
  async createFeedContent(
    @Body() body: SaveContentDto,
    @Req() req: CredentialRequest
  ) {
    const ability = this.caslAbility.createForCredential(req.$credential);
    if (!ability.can(Action.Create, Content))
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    const credentialUser = await this.userService.getUserFromCredential(
      req.$credential
    );
    const user = await this.authService.getUserFromCastcleId(body.castcleId);
    if (String(user.ownerAccount) === String(credentialUser.ownerAccount)) {
      const newBody = await this.appService.uploadContentToS3(body, user);
      console.debug('user', user);
      console.debug('uploadedBody', newBody);
      const content = await this.contentService.createContentFromUser(
        user,
        newBody
      );
      console.debug('content', content);
      //TODO !!! need to remove after done feed
      this.contentProducer.sendMessage({
        action: CastcleQueueAction.CreateFeedItemToEveryOne,
        id: content._id
      });
      console.debug('test', content.toContentPayload());
      console.debug('contentAfterToContent', content);
      const payloadResponse = {
        payload: content.toContentPayload()
      };
      console.debug('payloadResponse', payloadResponse);
      console.debug('payloadResponse', payloadResponse.payload);

      return payloadResponse;
    } else {
      throw new CastcleException(
        CastcleStatus.FORBIDDEN_REQUEST,
        req.$language
      );
    }
  }

  @ApiOkResponse({
    type: ContentResponse
  })
  @CastcleAuth(CacheKeyName.Contents)
  @Get(':id')
  async getContentFromId(
    @Param('id') id: string,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);
    const user = await this.userService.getUserFromCredential(req.$credential);
    const engagements =
      await this.contentService.getAllEngagementFromContentAndUser(
        content,
        user
      );
    return {
      payload: content.toContentPayload(engagements)
    } as ContentResponse;
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
    const user = await this.userService.getUserFromCredential(req.$credential);
    console.log('caslUser', user as User);
    const ability = this.caslAbility.getUserManageContentAbility(user, content);
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

  @ApiBody({
    type: SaveContentDto
  })
  @ApiOkResponse({
    type: ContentResponse
  })
  @CastleClearCacheAuth(CacheKeyName.Contents)
  @Put(':id')
  async updateContentFromId(
    @Param('id') id: string,
    @Body() body: SaveContentDto,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);
    await this._checkPermissionForUpdate(content, req);
    const user = await this.userService.getUserFromCredential(req.$credential);
    const newBody = await this.appService.uploadContentToS3(body, user);
    console.debug('newBody', newBody);
    const updatedContent = await this.contentService.updateContentFromId(
      content._id,
      newBody
    );
    console.debug('updatedContent', updatedContent);
    return {
      payload: updatedContent.toContentPayload()
    } as ContentResponse;
  }

  @ApiResponse({
    status: 204
  })
  @CastleClearCacheAuth(CacheKeyName.Contents)
  @HttpCode(204)
  @Delete(':id')
  async deleteContentFromId(
    @Param('id') id: string,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(id, req);
    await this._checkPermissionForUpdate(content, req);
    content.delete();
    return '';
  }

  @ApiOkResponse({
    type: ContentResponse
  })
  @CastcleAuth(CacheKeyName.Contents)
  @Get()
  async getContents(
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
  ) {
    const result = await this.contentService.getContentsForAdmin({
      limit: limitOption,
      page: pageOption,
      sortBy: sortByOption,
      type: contentTypeOption
    });

    return {
      payload: result.items.map((c) => c.toContentPayload()),
      pagination: result.pagination
    } as ContentsResponse;
  }

  @ApiResponse({
    status: 204
  })
  @CastleClearCacheAuth(CacheKeyName.Contents)
  @Put(':id/liked')
  @HttpCode(204)
  async likeContent(
    @Param('id') id: string,
    @Body('castcleId') castcleId: string,
    @Req() req: CredentialRequest
  ) {
    //TODO !!! has to add feedItem once implement
    const content = await this._getContentIfExist(id, req);
    const user = await this.appService.getUserFromBody(req, castcleId);
    await this.contentService.likeContent(content, user);
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
      payload: result.recastContent.toContentPayload()
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
      payload: result.quoteContent.toContentPayload()
    } as ContentResponse;
  }
}
