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
  GetContentDto,
  GetContentQuery,
  GetFollowQuery,
  GetKeywordQuery,
  GetSourceContentParam,
  GetUserParam,
  LikeCommentDto,
  NotificationSource,
  NotificationType,
  PageResponseDto,
  PaginationQuery,
  QuoteCastDto,
  ReplyCommentParam,
  ResponseDto,
  SyncSocialDtoV2,
  TargetIdParam,
  UnlikeCommentCastParam,
  UpdateCommentDto,
  UpdateMobileDto,
  UpdateUserDtoV2,
} from '@castcle-api/database/dtos';
import { Comment, CommentType } from '@castcle-api/database/schemas';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleControllerV2,
  RequestMeta,
  RequestMetadata,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
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
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ReportingUserDto,
  TargetCastcleDto,
  ReportingContentDto,
} from '../dtos';
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
    private suggestionService: SuggestionService,
  ) {}

  private validateObjectId(id: string) {
    this.logger.log(`Validate is object id: ${id}`);
    const ObjectId = Types.ObjectId;
    if (!ObjectId.isValid(id)) throw CastcleException.CONTENT_NOT_FOUND;
  }

  @CastcleBasicAuth()
  @Put('me/mobile')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateMobile(
    @Auth() authorizer: Authorizer,
    @Body() updateMobileDto: UpdateMobileDto,
    @RequestMeta() { ip }: RequestMetadata,
  ) {
    return this.userServiceV2.updateMobile(
      authorizer.account,
      updateMobileDto,
      ip,
    );
  }

  @CastcleBasicAuth()
  @Post(':userId/sync-social')
  async syncSocial(
    @Auth() authorizer: Authorizer,
    @Body() syncSocialDto: SyncSocialDtoV2,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userServiceV2.getUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    return this.socialSyncService.sync(user, syncSocialDto);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get('by')
  getUserByKeyword(
    @Auth() authorizer: Authorizer,
    @Query() query: GetKeywordQuery,
  ) {
    authorizer.requestAccessForAccount(authorizer.account._id);
    return this.userServiceV2.getUserByKeyword(query, authorizer.user);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get(':userId')
  async getUserById(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
    @Query() userQuery?: ExpansionQuery,
  ) {
    return isMe
      ? authorizer.user.toUserResponseV2({
          passwordNotSet: !authorizer.account.password,
        })
      : this.userServiceV2.getById(
          authorizer.user,
          await this.userServiceV2.getUser(userId),
          userQuery?.hasRelationshipExpansion,
          userQuery?.userFields,
        );
  }

  @CastcleClearCacheAuth(CacheKeyName.Users)
  @CastcleBasicAuth()
  @Put(':userId')
  async updateMyData(
    @Auth() authorizer: Authorizer,
    @Body() body: UpdateUserDtoV2,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userServiceV2.getUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    if (body.castcleId) {
      if (!user.canUpdateCastcleId())
        throw CastcleException.CHANGE_CASTCLE_ID_FAILED;

      const userExisting = await this.authService.getExistedUserFromCastcleId(
        body.castcleId,
      );

      if (userExisting && String(userExisting?.id) !== String(user?.id))
        throw CastcleException.USER_ID_IS_EXIST;
    }

    const prepareUser = await this.userService.uploadUserInfo(
      body,
      authorizer.account._id,
    );

    const updateUser = await this.userService.updateUser(user, prepareUser);
    return updateUser.toUserResponseV2(
      isMe ? { passwordNotSet: !authorizer.account.password } : undefined,
    );
  }

  @CastcleBasicAuth()
  @Post(':userId/comments')
  async createComment(
    @Auth() authorizer: Authorizer,
    @Body() commentDto: CreateCommentDto,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    this.logger.log('Start comment : ' + JSON.stringify(commentDto));

    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const content = await this.contentService.getContentById(
      commentDto.contentId,
    );

    const comment = await this.contentService.createCommentForContent(
      user,
      content,
      { message: commentDto.message },
    );

    const userOwner = await this.userService.getByIdOrCastcleId(
      content.author.id,
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
      authorizer.account.preferences.languages[0],
    );

    const payload = await this.commentService.convertCommentToCommentResponse(
      user,
      comment,
      [],
      { hasRelationshipExpansion: false },
    );

    return payload;
  }

  @CastcleBasicAuth()
  @Put(':userId/comments/:sourceCommentId')
  async updateComment(
    @Auth() authorizer: Authorizer,
    @Body() updateCommentDto: UpdateCommentDto,
    @Param() { sourceCommentId, isMe, userId }: CommentParam,
  ) {
    this.logger.log(
      `Start update comment id: ${sourceCommentId}, body: ${JSON.stringify(
        updateCommentDto,
      )}`,
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
      { hasRelationshipExpansion: false },
    );
  }

  @CastcleBasicAuth()
  @Delete(':userId/comments/:sourceCommentId')
  async deleteComment(
    @Auth() authorizer: Authorizer,
    @Param() { sourceCommentId, isMe, userId }: CommentParam,
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
    @Param() { sourceCommentId, isMe, userId }: CommentParam,
  ) {
    this.logger.log(
      `Start reply comment id: ${sourceCommentId}, body: ${JSON.stringify(
        replyCommentBody,
      )}`,
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
      comment.author._id,
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
      authorizer.account.preferences.languages[0],
    );

    return await this.commentService.convertCommentToCommentResponse(
      user,
      replyComment,
      [],
      { hasRelationshipExpansion: false },
    );
  }

  @CastcleBasicAuth()
  @Put(':userId/comments/:sourceCommentId/reply/:replyCommentId')
  async updateReplyComment(
    @Auth() authorizer: Authorizer,
    @Body() updateCommentDto: UpdateCommentDto,
    @Param()
    { sourceCommentId, replyCommentId, isMe, userId }: ReplyCommentParam,
  ) {
    this.logger.log(
      `Start update reply comment id: ${sourceCommentId} , reply comment id: ${replyCommentId} ,body: ${JSON.stringify(
        updateCommentDto,
      )}`,
    );
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);
    this.validateObjectId(sourceCommentId);
    this.validateObjectId(replyCommentId);
    const comment = await this.contentService.getCommentById(sourceCommentId);
    const replyComment = await this.contentService.getCommentById(
      replyCommentId,
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
      },
    );

    return await this.commentService.convertCommentToCommentResponse(
      user,
      updatedComment,
      [],
      { hasRelationshipExpansion: false },
    );
  }

  @CastcleBasicAuth()
  @Delete(':userId/comments/:sourceCommentId/reply/:replyCommentId')
  async deleteReplyComment(
    @Auth() authorizer: Authorizer,
    @Param()
    { sourceCommentId, replyCommentId, isMe, userId }: ReplyCommentParam,
  ) {
    this.logger.log(
      `Start delete reply comment id: ${sourceCommentId} , reply comment id: ${replyCommentId}`,
    );
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    this.validateObjectId(sourceCommentId);

    const comment = await this.contentService.getCommentById(sourceCommentId);
    const replyComment = await this.contentService.getCommentById(
      replyCommentId,
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
    @Body() { contentId }: GetContentDto,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const { content } = await this.contentServiceV2.likeCast(
      contentId,
      user,
      authorizer.account,
    );

    const feedItem = await this.rankerService.getFeedItem(
      authorizer.account,
      content,
    );

    if (!feedItem) return;

    await this.suggestionService.seen(
      authorizer.account,
      feedItem._id,
      authorizer.credential,
    );
  }
  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @Delete(':userId/likes-casts/:sourceContentId')
  async unlikeCast(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId, sourceContentId }: GetSourceContentParam,
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
    @Body() { commentId }: LikeCommentDto,
    @Param() { isMe, userId }: GetUserParam,
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
        comment.targetRef.oid,
      );
      if (!originalComment) throw CastcleException.REQUEST_URL_NOT_FOUND;
    }
    const content = await this.contentService.getContentById(
      comment.type === CommentType.Reply
        ? originalComment.targetRef.oid
        : comment.targetRef.oid,
    );

    await this.commentService.likeCommentCast(
      originalComment,
      comment,
      content,
      user,
      authorizer.account,
    );

    const feedItem = await this.rankerService.getFeedItem(
      authorizer.account,
      content,
    );

    if (!feedItem) return;

    await this.suggestionService.seen(
      authorizer.account,
      feedItem._id,
      authorizer.credential,
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Comments)
  @CastcleBasicAuth()
  @Delete(':userId/likes-comments/:sourceCommentId')
  async unlikeCommentCast(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId, sourceCommentId }: UnlikeCommentCastParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);
    this.validateObjectId(sourceCommentId);
    await this.commentService.unlikeCommentCast(sourceCommentId, user);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get('me/pages')
  async getMyPages(@Auth() authorizer: Authorizer) {
    const pages = await this.userServiceV2.getMyPages(authorizer.user);
    return ResponseDto.ok<PageResponseDto[]>({
      payload: pages,
    });
  }

  @Post(':userId/blocking')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async blockUser(
    @Auth() authorizer: Authorizer,
    @Body() { targetCastcleId }: TargetCastcleDto,
    @Param()
    { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);
    authorizer.requestAccessForAccount(user.ownerAccount);

    return this.userServiceV2.blockUser(user, targetCastcleId);
  }

  @Delete(':userId/blocking/:targetCastcleId')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblockUser(
    @Auth() authorizer: Authorizer,
    @Param()
    { targetCastcleId, isMe, userId }: TargetIdParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);
    authorizer.requestAccessForAccount(user.ownerAccount);

    return this.userServiceV2.unblockUser(user, targetCastcleId);
  }

  @CastcleBasicAuth()
  @Post(':userId/recasts')
  async recastContent(
    @Auth() authorizer: Authorizer,
    @Body() { contentId }: GetContentDto,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    this.logger.log(`Start recast content id: ${contentId}`);
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const recast = await this.contentServiceV2.recast(
      contentId,
      user,
      authorizer.account,
    );

    const feedItem = await this.rankerService.getFeedItem(
      authorizer.account,
      recast.recastContent,
    );

    if (feedItem) {
      await this.suggestionService.seen(
        authorizer.account,
        feedItem._id,
        authorizer.credential,
      );
    }

    return await this.contentServiceV2.getRecastPipeline(
      recast.recastContent._id,
      user,
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Contents)
  @CastcleBasicAuth()
  @Delete(':userId/recasts/:sourceContentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async undoRecast(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId, sourceContentId }: GetSourceContentParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    await this.contentServiceV2.undoRecast(sourceContentId, user);
  }

  @Get(':userId/blocking')
  @CastcleBasicAuth()
  async blockLookup(
    @Auth() authorizer: Authorizer,
    @Query() paginationQuery: PaginationQuery,
    @Param()
    { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    const { users, meta } = await this.userServiceV2.getBlockedLookup(
      user,
      paginationQuery,
    );

    return ResponseDto.ok({ payload: users, meta });
  }

  @CastcleBasicAuth()
  @Post(':userId/quotecasts')
  async quoteContent(
    @Auth() authorizer: Authorizer,
    @Body() { contentId, message }: QuoteCastDto,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    this.logger.log(`Start quote cast content id: ${contentId}`);
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    const quotecasts = await this.contentServiceV2.quoteCast(
      contentId,
      message,
      user,
      authorizer.account,
    );

    const feedItem = await this.rankerService.getFeedItem(
      authorizer.account,
      quotecasts.quoteContent,
    );

    if (feedItem) {
      await this.suggestionService.seen(
        authorizer.account,
        feedItem._id,
        authorizer.credential,
      );
    }

    return await this.contentServiceV2.getQuoteCastPipeline(
      quotecasts.quoteContent._id,
      user,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @CastcleClearCacheAuth(CacheKeyName.Users)
  @Post(':userId/following')
  async following(
    @Param() { isMe, userId }: GetUserParam,
    @Body() body: TargetCastcleDto,
    @Auth() authorizer: Authorizer,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);
    authorizer.requestAccessForAccount(user.ownerAccount);

    await this.userServiceV2.followUser(
      user,
      body.targetCastcleId,
      user.ownerAccount,
    );
  }

  @Delete(':userId/following/:targetCastcleId')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(
    @Auth() authorizer: Authorizer,
    @Param()
    { targetCastcleId, isMe, userId }: TargetIdParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);
    authorizer.requestAccessForAccount(user.ownerAccount);

    return this.userServiceV2.unfollowUser(user, targetCastcleId);
  }

  @CastcleBasicAuth()
  @Get(':userId/contents')
  async getContents(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
    @Query() query: GetContentQuery,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(authorizer.account._id);
    return await this.contentServiceV2.getContents(query, user);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get(':userId/followers')
  async getUserFollower(
    @Param() { isMe, userId }: GetUserParam,
    @Auth() authorizer: Authorizer,
    @Query() query: GetFollowQuery,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    const { users, meta } = await this.userServiceV2.getFollowers(
      authorizer.account,
      user,
      query,
    );

    return ResponseDto.ok({ payload: users, meta });
  }

  @Post(':userId/reporting/user')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportUser(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
    @Body() { message, targetCastcleId }: ReportingUserDto,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    await this.userServiceV2.reportUser(user, targetCastcleId, message);
  }

  @Post(':userId/reporting/content')
  @CastcleBasicAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportContent(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
    @Body() { message, targetContentId }: ReportingContentDto,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    await this.userServiceV2.reportContent(user, targetContentId, message);
  }
}
