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
  CommentServiceV2,
  ContentService,
  NotificationServiceV2,
  SocialSyncServiceV2,
  UserService,
  UserServiceV2,
  UserType,
} from '@castcle-api/database';
import {
  CommentParam,
  CreateCommentDto,
  ExpansionQuery,
  GetUserParam,
  NotificationSource,
  NotificationType,
  ReplyCommentParam,
  SyncSocialDtoV2,
  UpdateCommentDto,
  UpdateUserDtoV2,
} from '@castcle-api/database/dtos';
import { CastLogger } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils/cache';
import { CastcleDate } from '@castcle-api/utils/commons';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';

@CastcleControllerV2({ path: 'users' })
export class UsersControllerV2 {
  private logger = new CastLogger(UsersControllerV2.name);
  constructor(
    private socialSyncService: SocialSyncServiceV2,
    private authService: AuthenticationService,
    private userService: UserService,
    private userServiceV2: UserServiceV2,
    private commentService: CommentServiceV2,
    private contentService: ContentService,
    private notificationServiceV2: NotificationServiceV2
  ) {}

  @CastcleBasicAuth()
  @Post(':userId/sync-social')
  async syncSocial(
    @Auth() authorizer: Authorizer,
    @Body() syncSocialDto: SyncSocialDtoV2,
    @Param() { isMe, userId }: GetUserParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    return this.socialSyncService.sync(user, syncSocialDto);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get(':userId')
  async getUserById(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
    @Query() userQuery?: ExpansionQuery
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    return this.userServiceV2.getById(
      authorizer.user,
      user,
      userQuery?.hasRelationshipExpansion,
      userQuery?.userFields
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Users)
  @CastcleBasicAuth()
  @Put(':userId')
  async updateMyData(
    @Auth() authorizer: Authorizer,
    @Body() body: UpdateUserDtoV2,
    @Param() { isMe, userId }: GetUserParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    if (body.castcleId) {
      if (!CastcleDate.verifyUpdateCastcleId(user.displayIdUpdatedAt))
        throw CastcleException.CHANGE_CASTCLE_ID_FAILED;

      const userExisting = await this.authService.getExistedUserFromCastcleId(
        body.castcleId
      );

      if (String(userExisting?.id) !== String(user?.id))
        throw CastcleException.USER_ID_IS_EXIST;
    }

    const prepareUser = await this.userService.uploadUserInfo(
      body,
      authorizer.account._id
    );

    const updateUser = await this.userService.updateUser(user, prepareUser);
    return updateUser.toUserResponse();
  }

  @CastcleBasicAuth()
  @Post(':userId/comments')
  async createComment(
    @Auth() authorizer: Authorizer,
    @Body() commentDto: CreateCommentDto,
    @Param() { isMe, userId }: GetUserParam
  ) {
    this.logger.log('Start comment : ' + JSON.stringify(commentDto));

    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const content = await this.contentService.getContentById(
      commentDto.contentId
    );

    const comment = await this.contentService.createCommentForContent(
      user,
      content,
      { message: commentDto.message }
    );

    const userOwner = await this.userService.getByIdOrCastcleId(
      content.author.id
    );

    await this.notificationServiceV2.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Comment,
        contentRef: content._id,
        commentRef: comment._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      authorizer.account.preferences.languages[0]
    );

    const payload = await this.commentService.convertCommentToCommentResponse(
      user,
      comment,
      [],
      { hasRelationshipExpansion: false }
    );

    return payload;
  }

  @CastcleBasicAuth()
  @Put(':userId/comments/:sourceCommentId')
  async updateComment(
    @Auth() authorizer: Authorizer,
    @Body() updateCommentDto: UpdateCommentDto,
    @Param() { sourceCommentId, isMe, userId }: CommentParam
  ) {
    this.logger.log(
      `Start update comment id: ${sourceCommentId}, body: ${JSON.stringify(
        updateCommentDto
      )}`
    );
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const comment = await this.contentService.getCommentById(sourceCommentId);
    if (!comment || String(comment.author._id) !== String(user.id))
      throw CastcleException.FORBIDDEN;

    const updatedComment = await this.contentService.updateComment(comment, {
      message: updateCommentDto.message,
    });

    return await this.commentService.convertCommentToCommentResponse(
      user,
      updatedComment,
      [],
      { hasRelationshipExpansion: false }
    );
  }

  @CastcleBasicAuth()
  @Delete(':userId/comments/:sourceCommentId')
  async deleteComment(
    @Auth() authorizer: Authorizer,
    @Param() { sourceCommentId, isMe, userId }: CommentParam
  ) {
    this.logger.log(`Start delete comment id: ${sourceCommentId})}`);
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    const comment = await this.contentService.getCommentById(sourceCommentId);
    if (!comment || String(comment.author._id) !== String(user.id))
      throw CastcleException.FORBIDDEN;
    await this.commentService.deleteComment(comment);
  }

  @CastcleBasicAuth()
  @Post(':userId/comments/:sourceCommentId/reply')
  async replyComment(
    @Auth() authorizer: Authorizer,
    @Body() replyCommentBody: UpdateCommentDto,
    @Param() { sourceCommentId, isMe, userId }: CommentParam
  ) {
    this.logger.log(
      `Start reply comment id: ${sourceCommentId}, body: ${JSON.stringify(
        replyCommentBody
      )}`
    );
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const comment = await this.contentService.getCommentById(sourceCommentId);
    if (!comment) throw CastcleException.FORBIDDEN;

    const replyComment = await this.contentService.replyComment(user, comment, {
      message: replyCommentBody.message,
    });

    const userOwner = await this.userService.getByIdOrCastcleId(
      comment.author._id
    );

    await this.notificationServiceV2.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: user._id,
        type: NotificationType.Reply,
        contentRef: comment.targetRef.oid,
        commentRef: comment._id,
        replyRef: replyComment._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      authorizer.account.preferences.languages[0]
    );

    return await this.commentService.convertCommentToCommentResponse(
      user,
      replyComment,
      [],
      { hasRelationshipExpansion: false }
    );
  }

  @CastcleBasicAuth()
  @Put(':userId/comments/:sourceCommentIdreply/:replyCommentId')
  async updateReplyComment(
    @Auth() authorizer: Authorizer,
    @Body() updateCommentDto: UpdateCommentDto,
    @Param()
    { sourceCommentId, replyCommentId, isMe, userId }: ReplyCommentParam
  ) {
    this.logger.log(
      `Start update reply comment id: ${sourceCommentId} , reply comment id: ${replyCommentId} ,body: ${JSON.stringify(
        updateCommentDto
      )}`
    );
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const comment = await this.contentService.getCommentById(sourceCommentId);
    const replyComment = await this.contentService.getCommentById(
      replyCommentId
    );
    if (
      !comment ||
      !replyComment ||
      String(replyComment.author._id) !== String(user.id)
    )
      throw CastcleException.FORBIDDEN;

    const updatedComment = await this.contentService.updateComment(
      replyComment,
      {
        message: updateCommentDto.message,
      }
    );

    return await this.commentService.convertCommentToCommentResponse(
      user,
      updatedComment,
      [],
      { hasRelationshipExpansion: false }
    );
  }

  @CastcleBasicAuth()
  @Delete(':userId/comments/:sourceCommentId/reply/:replyCommentId')
  async deleteReplyComment(
    @Auth() authorizer: Authorizer,
    @Param()
    { sourceCommentId, replyCommentId, isMe, userId }: ReplyCommentParam
  ) {
    this.logger.log(
      `Start delete reply comment id: ${sourceCommentId} , reply comment id: ${replyCommentId}`
    );
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    const comment = await this.contentService.getCommentById(sourceCommentId);
    const replyComment = await this.contentService.getCommentById(
      replyCommentId
    );
    if (
      !comment ||
      !replyComment ||
      String(replyComment.author._id) !== String(user.id)
    )
      throw CastcleException.FORBIDDEN;

    await this.commentService.deleteComment(replyComment);
  }
}
