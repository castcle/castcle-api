import { Configs } from '@castcle-api/environments';
import { Image } from '@castcle-api/utils/aws';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { createCastcleMeta } from '../database.module';
import {
  CastcleQueryOptions,
  CommentPayload,
  CommentsResponse,
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility,
  ExpansionQuery,
} from '../dtos';
import {
  CommentDocument,
  CommentType,
  EngagementDocument,
  EngagementType,
  UserDocument,
} from '../schemas';
import { RelationshipDocument } from '../schemas/relationship.schema';
import { RevisionDocument } from '../schemas/revision.schema';
import { getRelationship } from '../utils/common';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel('Comment')
    private commentModel: Model<CommentDocument>,
    @InjectModel('Engagement')
    private engagementModel: Model<EngagementDocument>,
    @InjectModel('Relationship')
    private relationshipModel: Model<RelationshipDocument>,
    @InjectModel('Revision')
    private revisionModel: Model<RevisionDocument>
  ) {}

  async convertCommentToCommentResponse(
    viewer: UserDocument,
    comment: CommentDocument,
    engagements: EngagementDocument[],
    { hasRelationshipExpansion }: ExpansionQuery
  ) {
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

    return this.mapContentToContentResponse(
      comment,
      engagements,
      relationships,
      hasRelationshipExpansion,
      revisionCount,
      replies,
      viewer
    );
  }

  private getLike(engagements: EngagementDocument[], id: string) {
    return engagements.some(({ targetRef, type }) => {
      return type === EngagementType.Like && String(targetRef.$id) === id;
    });
  }

  private mapContentToContentResponse(
    comment: CommentDocument,
    engagements: EngagementDocument[],
    relationships: any,
    hasRelationshipExpansion: boolean,
    revisionCount: number,
    replies: CommentDocument[],
    viewer?: UserDocument
  ) {
    const author = viewer
      ? {
          avatar:
            comment.author.profile &&
            comment.author.profile.images &&
            comment.author.profile.images.avatar
              ? new Image(comment.author.profile.images.avatar).toSignUrls()
              : Configs.DefaultAvatarImages,
          castcleId: comment.author.displayId,
          displayName: comment.author.displayName,
          id: comment.author._id,
          type: comment.author.type,
          verified: comment.author.verified,
          ...getRelationship(
            relationships,
            viewer._id,
            comment.author._id,
            hasRelationshipExpansion
          ),
        }
      : {
          avatar:
            comment.author.profile &&
            comment.author.profile.images &&
            comment.author.profile.images.avatar
              ? new Image(comment.author.profile.images.avatar).toSignUrls()
              : Configs.DefaultAvatarImages,
          castcleId: comment.author.displayId,
          displayName: comment.author.displayName,
          id: comment.author._id,
          type: comment.author.type,
          verified: comment.author.verified,
        };
    return {
      id: comment._id,
      message: comment.message,
      metrics: { likeCount: comment.engagements.like.count },
      participate: { liked: this.getLike(engagements, comment.id) },
      author: author,
      hasHistory: revisionCount > 1,
      reply: replies.map((reply) => {
        const replyAuthor = viewer
          ? {
              avatar:
                reply.author.profile &&
                reply.author.profile.images &&
                reply.author.profile.images.avatar
                  ? new Image(reply.author.profile.images.avatar).toSignUrls()
                  : Configs.DefaultAvatarImages,
              castcleId: reply.author.displayId,
              displayName: reply.author.displayName,
              id: reply.author._id,
              verified: reply.author.verified,
              type: reply.author.type,
              ...getRelationship(
                relationships,
                viewer._id,
                reply.author._id,
                hasRelationshipExpansion
              ),
            }
          : {
              avatar:
                reply.author.profile &&
                reply.author.profile.images &&
                reply.author.profile.images.avatar
                  ? new Image(reply.author.profile.images.avatar).toSignUrls()
                  : Configs.DefaultAvatarImages,
              castcleId: reply.author.displayId,
              displayName: reply.author.displayName,
              id: reply.author._id,
              verified: reply.author.verified,
              type: reply.author.type,
            };
        return {
          id: reply._id,
          createdAt: reply.createdAt.toISOString(),
          message: reply.message,
          author: replyAuthor,
          metrics: { likeCount: reply.engagements.like.count },
          participate: { liked: this.getLike(engagements, reply.id) },
        };
      }),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    } as CommentPayload;
  }

  async convertCommentsToCommentResponseForGuest(comments: CommentDocument[]) {
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
    return comments.map((comment) => {
      const revisionCount = revisions.filter(
        ({ objectRef }) => String(objectRef.$id) === String(comment._id)
      ).length;

      const commentReplies = replies.filter(({ targetRef }) => {
        return String(targetRef.oid) === String(comment._id);
      });

      return this.mapContentToContentResponse(
        comment,
        [],
        [],
        false,
        revisionCount,
        commentReplies
      );
    });
  }

  async convertCommentsToCommentResponse(
    viewer: UserDocument,
    comments: CommentDocument[],
    engagements: EngagementDocument[],
    { hasRelationshipExpansion }: ExpansionQuery
  ) {
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

    return comments.map((comment) => {
      const revisionCount = revisions.filter(
        ({ objectRef }) => String(objectRef.$id) === String(comment._id)
      ).length;

      const commentReplies = replies.filter(({ targetRef }) => {
        return String(targetRef.oid) === String(comment._id);
      });

      return this.mapContentToContentResponse(
        comment,
        engagements,
        relationships,
        hasRelationshipExpansion,
        revisionCount,
        commentReplies,
        viewer
      );
    });
  }

  getCommentsByContentIdFromGuest = async (
    contentId: string,
    options: CastcleQueryOptions
  ) => {
    const query: FilterQuery<CommentDocument> = {
      targetRef: { $id: contentId, $ref: 'content' },
      visibility: EntityVisibility.Publish,
    };

    const comments = await this.commentModel
      .find(query)
      .limit(options.limit)
      .skip(options.page - 1)
      .sort(
        `${options.sortBy.type === 'desc' ? '-' : ''}${options.sortBy.field}`
      )
      .exec();
    const payload = await this.convertCommentsToCommentResponseForGuest(
      comments
    );
    return {
      payload,
      meta: createCastcleMeta(comments),
    };
  };

  /**
   * Get Total Comment from content
   * @param {ContentDocument} content
   * @param {CastcleQueryOptions} options
   * @returns {total:number, items:CommentPayload[], pagination:Pagination}
   */
  getCommentsByContentId = async (
    viewer: UserDocument,
    contentId: string,
    options: CastcleQueryOptions & ExpansionQuery = {
      ...DEFAULT_QUERY_OPTIONS,
      hasRelationshipExpansion: false,
    }
  ): Promise<CommentsResponse> => {
    const query: FilterQuery<CommentDocument> = {
      targetRef: { $id: contentId, $ref: 'content' },
      visibility: EntityVisibility.Publish,
    };

    const comments = await this.commentModel
      .find(query)
      .limit(options.limit)
      .skip(options.page - 1)
      .sort(
        `${options.sortBy.type === 'desc' ? '-' : ''}${options.sortBy.field}`
      )
      .exec();

    const engagements = await this.engagementModel.find({
      targetRef: {
        $in: comments.map((comment) => ({ $ref: 'comment', $id: comment._id })),
      },
    });

    const payload = await this.convertCommentsToCommentResponse(
      viewer,
      comments,
      engagements,
      options
    );

    return {
      payload,
      meta: createCastcleMeta(comments),
    };
  };
}
