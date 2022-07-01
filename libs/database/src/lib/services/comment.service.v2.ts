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
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { AnyKeys, FilterQuery, Model, Types } from 'mongoose';
import {
  CommentIncludes,
  CommentPayload,
  CommentResponse,
  CreateNotification,
  EntityVisibility,
  ExpansionQuery,
  IncludeUser,
  NotificationSource,
  NotificationType,
  PaginationQuery,
  ResponseDto,
} from '../dtos';
import { CommentType, EngagementType, UserType } from '../models';
import { Repository } from '../repositories';
import {
  Account,
  Comment,
  Content,
  Engagement,
  Hashtag,
  Notification,
  Relationship,
  Revision,
  User,
} from '../schemas';
import {
  createCastcleFilter,
  createCastcleMeta,
  getRelationship,
} from '../utils/common';
import { NotificationServiceV2 } from './notification.service.v2';
import { UserService } from './user.service';

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
    public _engagementModel: Model<Engagement>,
    private userService: UserService,
    private notificationServiceV2: NotificationServiceV2,
    private repository: Repository,
  ) {}

  private removeEngagementComment = async (comment: Comment) => {
    if (![CommentType.Comment, CommentType.Reply].includes(comment.type))
      return;

    await this.repository.deleteEngagements({
      targetRef: {
        $ref: 'comment',
        $id: comment.targetRef.$id ?? comment.targetRef.oid,
      },
    });
  };

  private removeEngagementContent = async (
    comment: Comment,
    userId: string,
  ) => {
    if (![CommentType.Comment].includes(comment.type)) return;

    await this.repository.deleteEngagements({
      user: userId as any,
      targetRef: {
        $ref: 'content',
        $id: comment.targetRef.$id ?? comment.targetRef.oid,
      },
      type: CommentType.Comment,
    });
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
    return this.hashtagModel
      .updateOne(
        {
          tag: CastcleName.fromTagToSlug(tag),
          score: {
            $gt: 0,
          },
        },
        {
          $inc: {
            score: -1,
          },
        },
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
    relationships?: Relationship[],
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
            hasRelationshipExpansion,
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
    { hasRelationshipExpansion }: ExpansionQuery,
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
          relationships,
        ),
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
          [],
          viewer,
        );
      }),
    );

    return {
      payload: this.mapCommentToCommentResponse(
        comment,
        engagements,
        revisionCount,
        replies,
        viewer,
      ),
      includes: new CommentIncludes({ comments: replyPayload, users }),
    } as CommentResponse;
  }

  private getLike(engagements: Engagement[], id: string, viewer?: User) {
    return engagements.some(({ targetRef, type, user }) => {
      return (
        type === EngagementType.Like &&
        String(user) === String(viewer?._id) &&
        (String(targetRef.oid) === String(id) ||
          String(targetRef.$id) === String(id))
      );
    });
  }

  private mapCommentToCommentResponse(
    comment: Comment,
    engagements: Engagement[],
    revisionCount: number,
    replies: Comment[],
    viewer: User,
  ) {
    return {
      id: comment._id,
      message: comment.message,
      metrics: { likeCount: comment.engagements.like.count },
      participate: { liked: this.getLike(engagements, comment.id, viewer) },
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
    { hasRelationshipExpansion }: ExpansionQuery,
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
          { 'objectRef.$id': true },
        )
        .exec(),
    ]);

    const authorIds = [
      ...commentsAuthorIds,
      ...replies.map((reply) => reply.author._id),
    ];

    const relationships =
      hasRelationshipExpansion && viewer
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
              relationships,
            ),
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
          [],
          viewer,
        );
      }),
    );

    const commentPlyload = comments.map((comment) => {
      const revisionCount = revisions.filter(
        ({ objectRef }) => String(objectRef.$id) === String(comment._id),
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
            relationships,
          ),
        );
      }

      return this.mapCommentToCommentResponse(
        comment,
        engagements,
        revisionCount,
        commentReplies,
        viewer,
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
    paginationQuery: PaginationQuery,
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
    paginationQuery: PaginationQuery,
  ) => {
    return this.getComments(viewer, commentId, 'comment', paginationQuery);
  };

  private getComments = async (
    viewer: User,
    refId: string,
    refType: string,
    paginationQuery: PaginationQuery,
  ) => {
    let query: FilterQuery<Comment> = {
      targetRef: { $id: mongoose.Types.ObjectId(refId), $ref: refType },
      visibility: EntityVisibility.Publish,
    };

    this.logger.log('Get total rows');
    const total = await this.commentModel.countDocuments(query).exec();

    this.logger.log('Filter Since & Until');
    query = createCastcleFilter(query, {
      sinceId: paginationQuery?.sinceId,
      untilId: paginationQuery?.untilId,
    });

    this.logger.log(`Query: ${JSON.stringify(query)}`);
    const comments = total
      ? await this.commentModel
          .find(query)
          .limit(+paginationQuery.maxResults)
          .sort({ createdAt: -1 })
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
      paginationQuery,
    );

    return ResponseDto.ok<CommentPayload[], CommentIncludes>({
      includes: response.includes,
      payload: response.payload,
      meta: createCastcleMeta(comments, total),
    });
  };

  /**
   * Get Comment from id
   * @param {User} viewer
   * @param {string} commentId
   * @returns {payload:CommentPayload[], includes:CommentIncludes}
   */
  getCommentById = async (viewer: User, commentId: string) => {
    const query: FilterQuery<Comment> = {
      _id: mongoose.Types.ObjectId(commentId),
      visibility: EntityVisibility.Publish,
    };
    this.logger.log(`Query: ${JSON.stringify(query)}`);
    const comment = await this.commentModel.findOne(query).exec();

    const engagements = await this.engagementModel.find({
      targetRef: {
        $in: [{ $ref: 'comment', $id: comment._id }],
      },
    });

    return this.convertCommentToCommentResponse(viewer, comment, engagements, {
      hasRelationshipExpansion: false,
    });
  };

  /**
   *
   * @param {Comment} rootComment
   * @returns {Comment}
   */
  deleteComment = async (rootComment: Comment) => {
    const replies = await this.commentModel
      .find({
        type: CommentType.Reply,
        targetRef: { $id: rootComment._id, $ref: 'comment' },
        visibility: EntityVisibility.Publish,
      })
      .exec();

    if (rootComment.hashtags) await this.removeFromTags(rootComment.hashtags);
    await this.removeEngagementContent(rootComment, rootComment.author._id);
    await this.removeEngagementComment(rootComment);
    await this.removeRevision(rootComment);

    this.logger.log('Delete reply comment.');
    await Promise.all(
      replies.map((reply) => {
        if (reply.hashtags) this.removeFromTags(reply.hashtags);
        this.removeEngagementComment(reply);
        this.removeRevision(reply);
        reply.remove();
      }),
    );

    this.logger.log('Delete comment.');
    await rootComment.remove();
  };

  likeCommentCast = async (
    commentOriginal: Comment,
    comment: Comment,
    content: Content,
    user: User,
    account: Account,
  ) => {
    const engagement = await this._engagementModel.findOne({
      user: user._id,
      targetRef: {
        $ref: 'comment',
        $id: comment._id,
      },
      type: EngagementType.Like,
    });

    if (engagement) throw new CastcleException('LIKE_COMMENT_IS_EXIST');

    await new this._engagementModel({
      type: EngagementType.Like,
      user: user._id,
      account: user.ownerAccount,
      targetRef: {
        $ref: 'comment',
        $id: comment._id,
      },
      visibility: EntityVisibility.Publish,
    }).save();

    if (
      String(user._id) === String(comment.author._id) ||
      String(user._id) === String(content.author.id)
    )
      return;

    const userOwner = await this.userService.getByIdOrCastcleId(
      comment.author._id,
    );
    const notificationData: CreateNotification = {
      source:
        userOwner.type === UserType.PEOPLE
          ? NotificationSource.Profile
          : NotificationSource.Page,
      sourceUserId: user._id,
      type: NotificationType.Like,
      contentRef: content._id,
      commentRef:
        comment.type === CommentType.Reply ? commentOriginal?._id : comment._id,
      account: userOwner.ownerAccount,
      read: false,
    };

    if (comment.type === CommentType.Reply)
      notificationData.replyRef = comment._id;

    await this.notificationServiceV2.notifyToUser(
      notificationData,
      userOwner,
      account.preferences.languages[0],
    );

    return comment;
  };

  unlikeCommentCast = async (commentId: string, user: User) => {
    const engagement = await this._engagementModel.findOne({
      user: user._id,
      targetRef: {
        $ref: 'comment',
        $id: Types.ObjectId(commentId),
      },
      type: EngagementType.Like,
    });

    if (!engagement) return;

    const comment = await this.commentModel.findOne({
      _id: engagement.targetRef?.oid || engagement.targetRef?.$id,
    });

    const filter: AnyKeys<Notification> = {
      type: NotificationType.Like,
    };

    if (comment.type === CommentType.Comment) {
      filter.commentRef = Types.ObjectId(commentId);
      filter.replyRef = { $exists: false };
    } else {
      filter.replyRef = Types.ObjectId(commentId);
    }

    await this.repository.updateNotification(filter, {
      $pull: { sourceUserId: { $eq: user._id } },
    });
    const notification = await this.repository.findNotification(filter);

    if (notification && !notification?.sourceUserId?.length)
      await notification.remove();

    return engagement.remove();
  };
}
