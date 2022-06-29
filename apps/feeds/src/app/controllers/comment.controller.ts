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
  CommentService,
  ContentService,
  DEFAULT_QUERY_OPTIONS,
  ExpansionQuery,
  NotificationService,
  NotificationSource,
  NotificationType,
  RankerService,
  UserService,
  UserType,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import {
  CastcleAuth,
  CastcleBasicAuth,
  CastcleController,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { LimitPipe, PagePipe, SortByPipe } from '@castcle-api/utils/pipes';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import {
  CreateCommentBody,
  EditCommentBody,
  LikeCommentBody,
  ReplyCommentBody,
} from '../dtos/comment.dto';
import { SuggestionService } from '../services/suggestion.service';

@CastcleController({ path: 'contents', version: '1.0' })
export class CommentController {
  constructor(
    private authService: AuthenticationService,
    private commentService: CommentService,
    private contentService: ContentService,
    private notifyService: NotificationService,
    private userService: UserService,
    private rankerService: RankerService,
    private suggestionService: SuggestionService,
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
    @Query() expansionQuery: ExpansionQuery,
  ) {
    // try {
    const [authorizedUser, content, user] = await Promise.all([
      this.authService.getUserFromAccount($credential.account),
      this.contentService.getContentById(contentId),
      this.userService.getByIdOrCastcleId(commentBody.castcleId),
    ]);

    const comment = await this.contentService.createCommentForContent(
      user,
      content,
      { message: commentBody.message },
    );

    const feedItem = await this.rankerService.getFeedItem(
      $credential.account,
      content._id,
    );

    if (feedItem) {
      this.suggestionService.seen(
        $credential.account,
        feedItem._id,
        $credential,
      );
    }

    if (String(authorizedUser._id) !== String(content.author.id)) {
      const userOwner = await this.userService.getByIdOrCastcleId(
        content.author.id,
      );

      this.notifyService.notifyToUser(
        {
          source:
            userOwner.type === UserType.PEOPLE
              ? NotificationSource.Profile
              : NotificationSource.Page,
          sourceUserId: authorizedUser._id,
          type: NotificationType.Comment,
          contentRef: content._id,
          commentRef: comment._id,
          account: userOwner.ownerAccount,
          read: false,
        },
        user,
        $credential.account.preferences.languages[0],
      );
    }
    const payload = await this.commentService.convertCommentToCommentResponse(
      authorizedUser,
      comment,
      [],
      expansionQuery,
    );

    return { payload };
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
    limit = DEFAULT_QUERY_OPTIONS.limit,
  ) {
    const [authorizedUser, content] = await Promise.all([
      this.authService.getUserFromAccount($credential.account),
      this.contentService.getContentById(contentId),
    ]);
    if (authorizedUser)
      return this.commentService.getCommentsByContentId(
        authorizedUser,
        content._id,
        { ...expansionQuery, limit, page, sortBy },
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
    @Query() expansionQuery: ExpansionQuery,
  ) {
    const [authorizedUser, comment, user] = await Promise.all([
      this.authService.getUserFromAccount($credential.account),
      this.contentService.getCommentById(commentId),
      this.userService.getByIdOrCastcleId(replyCommentBody.castcleId),
    ]);
    const replyComment = await this.contentService.replyComment(user, comment, {
      message: replyCommentBody.message,
    });

    if (String(authorizedUser._id) !== String(comment.author._id)) {
      const userOwner = await this.userService.getByIdOrCastcleId(
        comment.author._id,
      );

      this.notifyService.notifyToUser(
        {
          source:
            userOwner.type === UserType.PEOPLE
              ? NotificationSource.Profile
              : NotificationSource.Page,
          sourceUserId: authorizedUser._id,
          type: NotificationType.Reply,
          contentRef: comment.targetRef.oid,
          commentRef: comment._id,
          replyRef: replyComment._id,
          account: userOwner.ownerAccount,
          read: false,
        },
        user,
        $credential.account.preferences.languages[0],
      );
    }
    return {
      payload: await this.commentService.convertCommentToCommentResponse(
        authorizedUser,
        replyComment,
        [],
        expansionQuery,
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
    @Query() expansionQuery: ExpansionQuery,
  ) {
    const authorizedUser = await this.authService.getUserFromAccount(
      $credential.account,
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
        expansionQuery,
      ),
    };
  }

  @HttpCode(204)
  @CastcleBasicAuth()
  @Delete(':id/comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string) {
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
    @Req() req: CredentialRequest,
    @Param('id') contentId: string,
    @Param('commentId') commentId: string,
    @Body() likeCommentBody: LikeCommentBody,
  ) {
    const [authorizedUser, comment, user, content] = await Promise.all([
      this.authService.getUserFromAccount(req.$credential.account),
      this.contentService.getCommentById(commentId),
      this.userService.getByIdOrCastcleId(likeCommentBody.castcleId),
      this.contentService.getContentFromId(contentId),
    ]);

    const likeComment = await this.contentService.likeComment(user, comment);

    if (!likeComment) throw new CastcleException('LIKE_IS_EXIST');

    if (String(authorizedUser._id) === String(comment.author._id)) return;
    const userOwner = await this.userService.getByIdOrCastcleId(
      comment.author._id,
    );

    this.notifyService.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: authorizedUser._id,
        type: NotificationType.Like,
        contentRef: content._id,
        commentRef: comment._id,
        account: user.ownerAccount,
        read: false,
      },
      user,
      req.$credential.account.preferences.languages[0],
    );
  }

  @ApiBody({
    type: LikeCommentBody,
  })
  @CastcleBasicAuth()
  @HttpCode(204)
  @Put(':id/comments/:commentId/unliked')
  async unlikeComment(
    @Param('commentId') commentId: string,
    @Body() likeCommentBody: LikeCommentBody,
  ) {
    const comment = await this.contentService.getCommentById(commentId);
    const user = await this.userService.getByIdOrCastcleId(
      likeCommentBody.castcleId,
    );
    await this.contentService.unlikeComment(user, comment);
    return '';
  }
}
