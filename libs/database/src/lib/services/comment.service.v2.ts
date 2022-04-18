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
import { Configs } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { Image } from '@castcle-api/utils/aws';
import { CastcleName } from '@castcle-api/utils/commons';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { createCastcleMeta } from '../database.module';
import {
  CommentIncludes,
  CommentPayload,
  CommentResponse,
  EntityVisibility,
  ExpansionQuery,
  IncludeUser,
  PaginationQuery,
  ResponseDto,
} from '../dtos';
import {
  Comment,
  CommentType,
  Engagement,
  EngagementType,
  Hashtag,
  Relationship,
  Revision,
  User,
} from '../schemas';
import { createCastcleFilter, getRelationship } from '../utils/common';

@Injectable()
export class CommentServiceV2 {
  private logger = new CastLogger(CommentServiceV2.name);
  constructor(
    @InjectModel('Comment')
    public commentModel: Model<Comment>,
    @InjectModel('Engagement')
    private engagementModel: Model<Engagement>,
    @InjectModel('Relationship')
    private relationshipModel: Model<Relationship>,
    @InjectModel('Revision')
    private revisionModel: Model<Revision>,
    @InjectModel('Hashtag')
    private hashtagModel: Model<Hashtag>,
    @InjectModel('Revision')
    public _revisionModel: Model<Revision>,
    @InjectModel('Engagement')
    public _engagementModel: Model<Engagement>
  ) {}

  /**
   * Delete all Comment Engagement from Content or Comment
   * @param {Comment} comment
   */
  private removeEngagementComment = async (comment: Comment) => {
    if (![CommentType.Comment, CommentType.Reply].includes(comment.type)) {
      return true;
    }

    const query: FilterQuery<Engagement> = {
      targetRef: {
        $ref: 'comment',
        $id: comment.targetRef.$id ?? comment.targetRef.oid,
      },
    };

    const engagements = await this._engagementModel.find(query).exec();
    await Promise.all(engagements.map((engagement) => engagement.remove()));
    return true;
  };

  private removeRevision = async (comment: Comment) => {
    const query: FilterQuery<Revision> = {
      targetRef: {
        $ref: 'comment',
        $id: comment.targetRef.$id ?? comment.targetRef.oid,
      },
    };

    const revisions = await this._revisionModel.find(query).exec();
    await Promise.all(revisions.map((revision) => revision.remove()));
    return true;
  };

  /**
   * Remove score from tag
   * @param {string} tag
   * @returns
   */
  private removeFromTag = async (tag: string) => {
    const name = new CastcleName(tag);
    return this.hashtagModel
      .updateOne(
        {
          tag: name.slug,
          score: {
            $gt: 0,
          },
        },
        {
          $inc: {
            score: -1,
          },
        }
      )
      .exec();
  };

  /**
   * Remove multiple tags
   * @param {string[]} tags
   * @returns
   */
  private removeFromTags = async (tags: string[]) =>
    Promise.all(tags.map((tag) => this.removeFromTag(tag)));

  private convertUserToAuthor(
    user: User,
    viewer?: User,
    hasRelationshipExpansion?: boolean,
    relationships?: Relationship[]
  ) {
    return viewer
      ? ({
          avatar:
            user.profile && user.profile.images && user.profile.images.avatar
              ? new Image(user.profile.images.avatar).toSignUrls()
              : Configs.DefaultAvatarImages,
          castcleId: user.displayId,
          displayName: user.displayName,
          id: user._id,
          type: user.type,
          verified: user.verified,
          ...getRelationship(
            relationships,
            viewer._id,
            user._id,
            hasRelationshipExpansion
          ),
        } as IncludeUser)
      : ({
          avatar:
            user.profile && user.profile.images && user.profile.images.avatar
              ? new Image(user.profile.images.avatar).toSignUrls()
              : Configs.DefaultAvatarImages,
          castcleId: user.displayId,
          displayName: user.displayName,
          id: user._id,
          type: user.type,
          verified: user.verified,
        } as IncludeUser);
  }

  async convertCommentToCommentResponse(
    viewer: User,
    comment: Comment,
    engagements: Engagement[],
    { hasRelationshipExpansion }: ExpansionQuery
  ) {
    const users: IncludeUser[] = [];
    const [replies, revisionCount] = await Promise.all([
      this.commentModel
        .find({
          type: CommentType.Reply,
          targetRef: { $id: comment._id, $ref: 'comment' },
          visibility: EntityVisibility.Publish,
        })
        .exec(),
      this.revisionModel
        .countDocuments({
          objectRef: { $id: comment._id, $ref: 'comment' },
          'payload.author._id': comment.author._id,
        })
        .exec(),
    ]);

    const authorIds = [
      comment.author._id,
      ...replies.map((reply) => reply.author._id),
    ];

    const relationships = hasRelationshipExpansion
      ? await this.relationshipModel.find({
          $or: [
            { user: viewer._id, followedUser: { $in: authorIds } },
            { user: { $in: authorIds }, followedUser: viewer._id },
          ],
          visibility: EntityVisibility.Publish,
        })
      : [];

    if (comment.author) {
      users.push(
        this.convertUserToAuthor(
          comment.author,
          viewer,
          hasRelationshipExpansion,
          relationships
        )
      );
    }

    const engagementsReply = await this.engagementModel.find({
      targetRef: {
        $in: replies.map((r) => ({ $ref: 'comment', $id: r._id })),
      },
    });

    const replyPayload = await Promise.all(
      replies.map(async (reply) => {
        const revisionReplyCount = await this.revisionModel
          .countDocuments({
            objectRef: { $id: reply._id, $ref: 'comment' },
            'payload.author._id': reply.author._id,
          })
          .exec();
        return this.mapCommentToCommentResponse(
          reply,
          engagementsReply,
          revisionReplyCount,
          []
        );
      })
    );

    return {
      payload: this.mapCommentToCommentResponse(
        comment,
        engagements,
        revisionCount,
        replies
      ),
      includes: new CommentIncludes({ comments: replyPayload, users }),
    } as CommentResponse;
  }

  private getLike(engagements: Engagement[], id: string) {
    return engagements.some(({ targetRef, type }) => {
      return type === EngagementType.Like && String(targetRef.$id) === id;
    });
  }

  private mapCommentToCommentResponse(
    comment: Comment,
    engagements: Engagement[],
    revisionCount: number,
    replies: Comment[]
  ) {
    return {
      id: comment._id,
      message: comment.message,
      metrics: { likeCount: comment.engagements.like.count },
      participate: { liked: this.getLike(engagements, comment.id) },
      author: comment.author._id,
      hasHistory: revisionCount > 1,
      reply: replies.map((reply) => reply._id),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    } as CommentPayload;
  }

  async convertCommentsToCommentResponse(
    viewer: User,
    comments: Comment[],
    engagements: Engagement[],
    { hasRelationshipExpansion }: ExpansionQuery
  ) {
    const users: IncludeUser[] = [];
    const commentsIds = comments.map(({ _id }) => _id);
    const commentsAuthorIds = comments.map(({ author }) => author._id);
    const [replies, revisions] = await Promise.all([
      this.commentModel
        .find({
          'targetRef.$id': { $in: commentsIds },
          'targetRef.$ref': 'comment',
          type: CommentType.Reply,
          visibility: EntityVisibility.Publish,
        })
        .exec(),
      this.revisionModel
        .find(
          {
            'objectRef.$id': { $in: commentsIds },
            'objectRef.$ref': 'comment',
            'payload.author._id': { $in: commentsAuthorIds },
          },
          { 'objectRef.$id': true }
        )
        .exec(),
    ]);

    const authorIds = [
      ...commentsAuthorIds,
      ...replies.map((reply) => reply.author._id),
    ];

    const relationships = hasRelationshipExpansion
      ? await this.relationshipModel.find({
          $or: [
            { user: viewer._id, followedUser: { $in: authorIds } },
            { user: { $in: authorIds }, followedUser: viewer._id },
          ],
          visibility: EntityVisibility.Publish,
        })
      : [];

    const engagementsReply = await this.engagementModel.find({
      targetRef: {
        $in: replies.map((r) => ({ $ref: 'comment', $id: r._id })),
      },
    });

    const replyPayload = await Promise.all(
      replies.map(async (reply) => {
        if (reply.author) {
          users.push(
            this.convertUserToAuthor(
              reply.author,
              viewer,
              hasRelationshipExpansion,
              relationships
            )
          );
        }
        const revisionReplyCount = await this.revisionModel
          .countDocuments({
            objectRef: { $id: reply._id, $ref: 'comment' },
            'payload.author._id': reply.author._id,
          })
          .exec();
        return this.mapCommentToCommentResponse(
          reply,
          engagementsReply,
          revisionReplyCount,
          []
        );
      })
    );

    const commentPlyload = comments.map((comment) => {
      const revisionCount = revisions.filter(
        ({ objectRef }) => String(objectRef.$id) === String(comment._id)
      ).length;

      const commentReplies = replies.filter(({ targetRef }) => {
        return String(targetRef.oid) === String(comment._id);
      });

      if (comment.author) {
        users.push(
          this.convertUserToAuthor(
            comment.author,
            viewer,
            hasRelationshipExpansion,
            relationships
          )
        );
      }

      return this.mapCommentToCommentResponse(
        comment,
        engagements,
        revisionCount,
        commentReplies
      );
    });

    return {
      payload: commentPlyload,
      includes: new CommentIncludes({ comments: replyPayload, users }),
    };
  }

  /**
   * Get Total Comment from content
   * @param {User} viewer
   * @param {Content} content
   * @param {CastcleQueryOptions} options
   * @returns {total:number, items:CommentPayload[], pagination:Pagination}
   */
  getCommentsByContentId = async (
    viewer: User,
    contentId: string,
    paginationQuery: PaginationQuery
  ) => {
    return this.getComments(viewer, contentId, 'content', paginationQuery);
  };

  /**
   * Get Total reply Comment from Comment
   * @param {User} viewer
   * @param {Content} content
   * @param {CastcleQueryOptions} options
   * @returns {total:number, items:CommentPayload[], pagination:Pagination}
   */
  getReplyCommentsByCommentId = async (
    viewer: User,
    commentId: string,
    paginationQuery: PaginationQuery
  ) => {
    return this.getComments(viewer, commentId, 'comment', paginationQuery);
  };

  private getComments = async (
    viewer: User,
    refId: string,
    refType: string,
    paginationQuery: PaginationQuery
  ) => {
    let query: FilterQuery<Comment> = {
      targetRef: { $id: refId, $ref: refType },
      visibility: EntityVisibility.Publish,
    };

    this.logger.log('Filter Since & Until');
    query = await createCastcleFilter(query, {
      sinceId: paginationQuery?.sinceId,
      untilId: paginationQuery?.untilId,
    });

    const total = await this.commentModel.countDocuments(query).exec();
    const comments = total
      ? await this.commentModel
          .find(query)
          .limit(+paginationQuery.maxResults)
          .sort(`createdAt: 1`)
          .exec()
      : [];

    const engagements = await this.engagementModel.find({
      targetRef: {
        $in: comments.map((comment) => ({ $ref: 'comment', $id: comment._id })),
      },
    });

    const response = await this.convertCommentsToCommentResponse(
      viewer,
      comments,
      engagements,
      { hasRelationshipExpansion: false }
    );

    return ResponseDto.ok<CommentPayload[], CommentIncludes>({
      includes: response.includes,
      payload: response.payload,
      meta: createCastcleMeta(comments, total),
    });
  };

  /**
   *
   * @param {Comment} rootComment
   * @returns {Comment}
   */
  deleteComment = async (rootComment: Comment) => {
    const comment = await this.commentModel.findById(rootComment._id);
    const replies = await this.commentModel
      .find({
        type: CommentType.Reply,
        targetRef: { $id: comment._id, $ref: 'comment' },
        visibility: EntityVisibility.Publish,
      })
      .exec();

    if (comment.hashtags) await this.removeFromTags(comment.hashtags);
    await this.removeEngagementComment(comment);
    await this.removeRevision(comment);

    this.logger.log('Delete reply comment.');
    await Promise.all(
      replies.map((reply) => {
        if (reply.hashtags) this.removeFromTags(reply.hashtags);
        this.removeEngagementComment(reply);
        this.removeRevision(reply);
        reply.remove();
      })
    );

    this.logger.log('Delete comment.');
    await comment.remove();
  };
}