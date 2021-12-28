import { Configs } from '@castcle-api/environments';
import { Image } from '@castcle-api/utils/aws';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createCastcleMeta } from '../database.module';
import {
  CastcleQueryOptions,
  CommentPayload,
  CommentsResponse,
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility,
  ExpansionQuery
} from '../dtos';
import {
  CommentDocument,
  CommentType,
  EngagementDocument,
  EngagementType,
  UserDocument
} from '../schemas';
import { RelationshipDocument } from '../schemas/relationship.schema';
import { RevisionDocument } from '../schemas/revision.schema';

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
    expansion: ExpansionQuery = { hasRelationshipExpansion: false }
  ) {
    const revisionCount = await this.revisionModel
      .countDocuments({
        objectRef: {
          $id: comment._id,
          $ref: 'comment'
        },
        'payload.author._id': comment.author._id
      })
      .exec();

    const replies = await this.commentModel
      .find({
        type: CommentType.Reply,
        targetRef: { $id: comment._id, $ref: 'comment' },
        visibility: EntityVisibility.Publish
      })
      .exec();

    const likedBy = (id: string) =>
      engagements?.some(
        ({ targetRef, type }) =>
          type === EngagementType.Like && String(targetRef.$id) === id
      ) ?? false;

    const authorIds = [
      comment.author._id,
      ...replies.map((reply) => reply.author._id)
    ];

    const relationships = await this.relationshipModel.find({
      $or: [
        { user: viewer._id, followedUser: { $in: authorIds } },
        { user: { $in: authorIds }, followedUser: viewer._id }
      ],
      visibility: EntityVisibility.Publish
    });

    const authorRelationship = relationships.find(
      ({ followedUser, user }) =>
        String(user) === String(comment.author._id) &&
        String(followedUser) === String(viewer.id)
    );

    const getterRelationship = relationships.find(
      ({ followedUser, user }) =>
        String(followedUser) === String(comment.author._id) &&
        String(user) === String(viewer.id)
    );

    const relationship = expansion.hasRelationshipExpansion
      ? {
          blocked: Boolean(getterRelationship?.blocking),
          blocking: Boolean(authorRelationship?.blocking),
          followed: Boolean(getterRelationship?.following)
        }
      : {};

    return {
      id: comment._id,
      message: comment.message,
      metrics: { likeCount: comment.engagements.like.count },
      participate: { liked: likedBy(comment.id) },
      author: {
        avatar: comment.author.profile
          ? new Image(comment.author.profile.images.avatar).toSignUrls()
          : Configs.DefaultAvatarImages,
        castcleId: comment.author.displayId,
        displayName: comment.author.displayName,
        id: comment.author._id,
        type: comment.author.type,
        verified: comment.author.verified,
        ...relationship
      },
      hasHistory: revisionCount > 1,
      reply: replies.map((reply) => {
        const authorRelationship = relationships.find(
          ({ followedUser, user }) =>
            String(user) === String(reply.author._id) &&
            String(followedUser) === String(viewer.id)
        );

        const getterRelationship = relationships.find(
          ({ followedUser, user }) =>
            String(followedUser) === String(reply.author._id) &&
            String(user) === String(viewer.id)
        );

        const relationship = expansion.hasRelationshipExpansion
          ? {
              blocked: Boolean(getterRelationship?.blocking),
              blocking: Boolean(authorRelationship?.blocking),
              followed: Boolean(getterRelationship?.following)
            }
          : {};

        return {
          id: reply._id,
          createdAt: reply.createdAt.toISOString(),
          message: reply.message,
          author: {
            avatar: reply.author.profile
              ? new Image(reply.author.profile.images.avatar).toSignUrls()
              : Configs.DefaultAvatarImages,
            castcleId: reply.author.displayId,
            displayName: reply.author.displayName,
            id: reply.author._id,
            verified: reply.author.verified,
            type: reply.author.type,
            ...relationship
          },
          metrics: { likeCount: reply.engagements.like.count },
          participate: { liked: likedBy(reply.id) }
        };
      }),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString()
    } as CommentPayload;
  }

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
      hasRelationshipExpansion: false
    }
  ): Promise<CommentsResponse> => {
    const filter = {
      targetRef: {
        $id: contentId,
        $ref: 'content'
      },
      visibility: EntityVisibility.Publish
    };

    const comments = await this.commentModel
      .find(filter)
      .limit(options.limit)
      .skip(options.page - 1)
      .sort(
        `${options.sortBy.type === 'desc' ? '-' : ''}${options.sortBy.field}`
      )
      .exec();

    const engagements = await this.engagementModel.find({
      targetRef: {
        $in: comments.map((comment) => ({ $ref: 'comment', $id: comment._id }))
      }
    });

    const payloads = await Promise.all(
      comments.map((comment) =>
        this.convertCommentToCommentResponse(
          viewer,
          comment,
          engagements,
          options
        )
      )
    );

    return {
      payload: payloads,
      meta: createCastcleMeta(comments)
    };
  };
}
