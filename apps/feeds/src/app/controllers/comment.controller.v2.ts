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
  CommentServiceV2,
  ContentService,
  PaginationQuery,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { Get, Param, Query } from '@nestjs/common';
import { isMongoId } from 'class-validator';

@CastcleControllerV2({ path: 'contents' })
export class CommentControllerV2 {
  private logger = new CastLogger(CommentControllerV2.name);
  constructor(
    private commentService: CommentServiceV2,
    private contentService: ContentService,
  ) {}

  private validateId(id: string) {
    this.logger.log(`Validate is object id: ${id}`);
    if (!isMongoId(id)) throw new CastcleException('CONTENT_NOT_FOUND');
  }

  @CastcleAuth(CacheKeyName.Comments)
  @Get(':contentId/comments')
  async getAllComment(
    @Param('contentId') contentId: string,
    @Auth() authorizer: Authorizer,
    @Query() query: PaginationQuery,
  ) {
    this.logger.log(`Start get all comment from content: ${contentId}`);
    this.validateId(contentId);
    const content = await this.contentService.getContentById(contentId);
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');
    return this.commentService.getCommentsByContentId(
      authorizer.user,
      content._id,
      query,
    );
  }

  @CastcleAuth(CacheKeyName.Comments)
  @Get(':contentId/comments/:sourceCommentId/reply')
  async getAllReplyComment(
    @Param('contentId') contentId: string,
    @Param('sourceCommentId') commentId: string,
    @Auth() authorizer: Authorizer,
    @Query() query: PaginationQuery,
  ) {
    this.logger.log(
      `Start get all reply comment from content: ${contentId} and comment: ${commentId}`,
    );
    this.validateId(contentId);
    this.validateId(commentId);
    const content = await this.contentService.getContentById(contentId);
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');
    return this.commentService.getReplyCommentsByCommentId(
      authorizer.user,
      commentId,
      query,
    );
  }

  @CastcleAuth(CacheKeyName.Comments)
  @Get(':contentId/comments/:sourceCommentId')
  async getCommentLookup(
    @Param('contentId') contentId: string,
    @Param('sourceCommentId') commentId: string,
    @Auth() authorizer: Authorizer,
    @Query() query: PaginationQuery,
  ) {
    this.logger.log(
      `Start lookup comment from content: ${contentId} and comment: ${commentId}`,
    );
    this.validateId(contentId);
    this.validateId(commentId);
    const content = await this.contentService.getContentById(contentId);
    const commentResult = await this.commentService.getCommentById(
      authorizer.user,
      commentId,
    );
    if (!commentResult || !commentResult.payload || !content)
      throw new CastcleException('CONTENT_NOT_FOUND');

    const replyResult = await this.commentService.getReplyCommentsByCommentId(
      authorizer.user,
      commentId,
      query,
    );
    const commentUsers = new Set(
      commentResult.includes.users.map((u) => u.castcleId),
    );
    const mergedUser = [
      ...commentResult.includes.users,
      ...replyResult.includes.users.filter(
        (rUser) => !commentUsers.has(rUser.castcleId),
      ),
    ];

    delete commentResult.payload.reply;
    return {
      payload: commentResult.payload,
      reply: replyResult.payload,
      includes: { users: mergedUser },
      meta: replyResult.meta,
    };
  }
}
