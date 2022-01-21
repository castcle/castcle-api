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
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  AuthenticationService,
  ContentService,
  NotificationService,
  CommentService,
} from '@castcle-api/database';
import {
  DEFAULT_QUERY_OPTIONS,
  ExpansionQuery,
  NotificationSource,
  NotificationType,
} from '@castcle-api/database/dtos';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { ApiBody } from '@nestjs/swagger';
import { LimitPipe, PagePipe, SortByPipe } from '@castcle-api/utils/pipes';
import {
  CreateCommentBody,
  EditCommentBody,
  LikeCommentBody,
  ReplyCommentBody,
} from '../dtos/comment.dto';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  CastcleController,
  CastcleAuth,
  CastcleBasicAuth,
} from '@castcle-api/utils/decorators';

@CastcleController('1.0')
@Controller()
@UsePipes(new ValidationPipe({ skipMissingProperties: true }))
export class CommentController {
  constructor(
    private authService: AuthenticationService,
    private commentService: CommentService,
    private contentService: ContentService,
    private notifyService: NotificationService
  ) {}

  @ApiBody({
    type: CreateCommentBody,
  })
  @CastcleBasicAuth()
  @Post(':id/comments')
  async createComment(
    @Param('id') contentId: string,
    @Body() commentBody: CreateCommentBody,
    @Req() { $credential }: CredentialRequest,
    @Query() expansionQuery: ExpansionQuery
  ) {
    try {
      const [authorizedUser, content, user] = await Promise.all([
        this.authService.getUserFromAccount($credential.account),
        this.contentService.getContentById(contentId),
        this.authService.getUserFromCastcleId(commentBody.castcleId),
      ]);

      const comment = await this.contentService.createCommentForContent(
        user,
        content,
        { message: commentBody.message }
      );

      this.notifyService.notifyToUser({
        type: NotificationType.Comment,
        message: `${user.displayName} ตอบกลับโพสต์ของคุณ`,
        read: false,
        source: NotificationSource.Profile,
        sourceUserId: user._id,
        targetRef: {
          _id: comment._id,
        },
        account: { _id: content.author.id },
      });

      const payload = await this.commentService.convertCommentToCommentResponse(
        authorizedUser,
        comment,
        [],
        expansionQuery
      );

      return { payload };
    } catch (error) {
      throw new CastcleException(CastcleStatus.INVALID_ACCESS_TOKEN);
    }
  }

  @CastcleAuth(CacheKeyName.Comments)
  @Get(':id/comments')
  async getAllComment(
    @Param('id') contentId: string,
    @Req() { $credential }: CredentialRequest,
    @Query() expansionQuery: ExpansionQuery,
    @Query('sortBy', SortByPipe)
    sortBy = DEFAULT_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    page = DEFAULT_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limit = DEFAULT_QUERY_OPTIONS.limit
  ) {
    const [authorizedUser, content] = await Promise.all([
      this.authService.getUserFromAccount($credential.account),
      this.contentService.getContentById(contentId),
    ]);
    if (authorizedUser)
      return this.commentService.getCommentsByContentId(
        authorizedUser,
        content._id,
        { ...expansionQuery, limit, page, sortBy }
      );
    else {
      //guestCase
      return this.commentService.getCommentsByContentIdFromGuest(content._id, {
        limit,
        page,
        sortBy,
      });
    }
  }

  @ApiBody({
    type: ReplyCommentBody,
  })
  @CastcleBasicAuth()
  @Post(':id/comments/:commentId/reply')
  async replyComment(
    @Param('commentId') commentId: string,
    @Body() replyCommentBody: ReplyCommentBody,
    @Req() { $credential }: CredentialRequest,
    @Query() expansionQuery: ExpansionQuery
  ) {
    const authorizedUser = await this.authService.getUserFromAccount(
      $credential.account
    );
    const comment = await this.contentService.getCommentById(commentId);
    const user = await this.authService.getUserFromCastcleId(
      replyCommentBody.castcleId
    );
    const replyComment = await this.contentService.replyComment(user, comment, {
      message: replyCommentBody.message,
    });
    this.notifyService.notifyToUser({
      type: NotificationType.Comment,
      message: `${user.displayName} ตอบกลับความคิดเห็นของคุณ`,
      read: false,
      source: NotificationSource.Profile,
      sourceUserId: user._id,
      targetRef: {
        _id: comment._id,
      },
      account: { _id: comment.author._id },
    });

    return {
      payload: await this.commentService.convertCommentToCommentResponse(
        authorizedUser,
        replyComment,
        [],
        expansionQuery
      ),
    };
  }

  @ApiBody({
    type: EditCommentBody,
  })
  @CastcleBasicAuth()
  @Put(':id/comments/:commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() editCommentBody: EditCommentBody,
    @Req() { $credential }: CredentialRequest,
    @Query() expansionQuery: ExpansionQuery
  ) {
    const authorizedUser = await this.authService.getUserFromAccount(
      $credential.account
    );
    const comment = await this.contentService.getCommentById(commentId);
    const updatedComment = await this.contentService.updateComment(comment, {
      message: editCommentBody.message,
    });

    return {
      payload: await this.commentService.convertCommentToCommentResponse(
        authorizedUser,
        updatedComment,
        [],
        expansionQuery
      ),
    };
  }

  @HttpCode(204)
  @CastcleBasicAuth()
  @Delete(':id/comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string) {
    //const content = await this._getContentIfExist(contentId, req);
    const comment = await this.contentService.getCommentById(commentId);
    await this.contentService.deleteComment(comment);
    return '';
  }

  @ApiBody({
    type: LikeCommentBody,
  })
  @HttpCode(204)
  @CastcleBasicAuth()
  @Put(':id/comments/:commentId/liked')
  async likeComment(
    @Param('id') contentId: string,
    @Param('commentId') commentId: string,
    @Body() likeCommentBody: LikeCommentBody
  ) {
    const comment = await this.contentService.getCommentById(commentId);
    const user = await this.authService.getUserFromCastcleId(
      likeCommentBody.castcleId
    );
    await this.contentService.likeComment(user, comment);
    this.notifyService.notifyToUser({
      type: NotificationType.Comment,
      message: `${user.displayName} ถูกใจความคิดเห็นคุณ`,
      read: false,
      source: NotificationSource.Profile,
      sourceUserId: user._id,
      targetRef: {
        _id: comment._id,
      },
      account: { _id: comment.author._id },
    });
    return '';
  }

  @ApiBody({
    type: LikeCommentBody,
  })
  @CastcleBasicAuth()
  @HttpCode(204)
  @Put(':id/comments/:commentId/unliked')
  async unlikeComment(
    @Param('commentId') commentId: string,
    @Body() likeCommentBody: LikeCommentBody
  ) {
    const comment = await this.contentService.getCommentById(commentId);
    const user = await this.authService.getUserFromCastcleId(
      likeCommentBody.castcleId
    );
    await this.contentService.unlikeComment(user, comment);
    return '';
  }
}
