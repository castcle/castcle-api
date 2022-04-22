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
  ContentServiceV2,
  NotificationServiceV2,
  RankerService,
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
  UnlikeCastParam,
  UnlikeCommentCastParam,
  UpdateCommentDto,
  UpdateUserDtoV2,
} from '@castcle-api/database/dtos';
import { Comment, CommentType } from '@castcle-api/database/schemas';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
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
import * as mongoose from 'mongoose';
import { SuggestionService } from '../services/suggestion.service';

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
    private contentServiceV2: ContentServiceV2,
    private notificationServiceV2: NotificationServiceV2,
    private rankerService: RankerService,
    private suggestionService: SuggestionService
  ) {}

  private validateObjectId(id: string) {
    this.logger.log(`Validate is object id: ${id}`);
    const ObjectId = mongoose.Types.ObjectId;
    if (!ObjectId.isValid(id)) throw CastcleException.CONTENT_NOT_FOUND;
  }

  @CastcleBasicAuth()
  @Post(':userId/sync-social')
  async syncSocial(
    @Auth() authorizer: Authorizer,
    @Body() syncSocialDto: SyncSocialDtoV2,
    @Param() { isMe, userId }: GetUserParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userServiceV2.getUser(userId);

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
      : await this.userServiceV2.getUser(userId);

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
      : await this.userServiceV2.getUser(userId);

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
    this.validateObjectId(sourceCommentId);
    const comment = await this.contentService.getCommentById(sourceCommentId);
    if (!comment || String(comment.author._id) !== String(user.id))
      throw CastcleException.CONTENT_NOT_FOUND;

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
    this.validateObjectId(sourceCommentId);
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
    this.validateObjectId(sourceCommentId);

    const comment = await this.contentService.getCommentById(sourceCommentId);
    if (!comment) throw CastcleException.CONTENT_NOT_FOUND;

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
  @Put(':userId/comments/:sourceCommentId/reply/:replyCommentId')
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
    this.validateObjectId(sourceCommentId);
    this.validateObjectId(replyCommentId);
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

    this.validateObjectId(sourceCommentId);

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

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Post(':userId/likes-casts')
  async likeCast(
    @Auth() authorizer: Authorizer,
    @Body('contentId') contentId: string,
    @Param() { isMe, userId }: GetUserParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);
    const content = await this.contentService.getContentById(contentId);

    if (!content) throw CastcleException.REQUEST_URL_NOT_FOUND;

    await this.contentServiceV2.likeCast(content, user, authorizer.account);

    const feedItem = await this.rankerService.getFeedItem(
      authorizer.account,
      content
    );

    if (!feedItem) return;

    await this.suggestionService.seen(
      authorizer.account,
      feedItem._id,
      authorizer.credential
    );
    return;
  }
  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Delete(':userId/likes-casts/:sourceContentId')
  async unlikeCast(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId, sourceContentId }: UnlikeCastParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    await this.contentServiceV2.unlikeCast(sourceContentId, user);
  }

  @CastcleClearCacheAuth(CacheKeyName.Comments)
  @CastcleBasicAuth()
  @Post(':userId/likes-comments')
  async likeCommentCast(
    @Auth() authorizer: Authorizer,
    @Body('commentId') commentId: string,
    @Param() { isMe, userId }: GetUserParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const comment = await this.contentService.getCommentById(commentId);
    if (!comment) throw CastcleException.REQUEST_URL_NOT_FOUND;

    let originalComment: Comment;
    if (comment.type === CommentType.Reply) {
      originalComment = await this.contentService.getCommentById(
        comment.targetRef.oid
      );
      if (!originalComment) throw CastcleException.REQUEST_URL_NOT_FOUND;
    }
    const content = await this.contentService.getContentById(
      comment.type === CommentType.Reply
        ? originalComment.targetRef.oid
        : comment.targetRef.oid
    );

    await this.commentService.likeCommentCast(
      originalComment,
      comment,
      content,
      user,
      authorizer.account
    );

    const feedItem = await this.rankerService.getFeedItem(
      authorizer.account,
      content
    );

    if (!feedItem) return;

    await this.suggestionService.seen(
      authorizer.account,
      feedItem._id,
      authorizer.credential
    );
    return;
  }

  @CastcleClearCacheAuth(CacheKeyName.Comments)
  @CastcleBasicAuth()
  @Delete(':userId/likes-comments/:sourceCommentId')
  async unlikeCommentCast(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId, sourceCommentId }: UnlikeCommentCastParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);
    this.validateObjectId(sourceCommentId);
    await this.commentService.unlikeCommentCast(sourceCommentId, user);
  }
}
