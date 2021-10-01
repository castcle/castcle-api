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

import { Model } from 'mongoose';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AccountDocument } from '../schemas/account.schema';
import {
  CommentDocument,
  CredentialDocument,
  CredentialModel
} from '../schemas';
import { User, UserDocument, UserType } from '../schemas/user.schema';
import { ContentDocument, Content } from '../schemas/content.schema';
import {
  EngagementDocument,
  EngagementType
} from '../schemas/engagement.schema';
import { createPagination } from '../utils/common';
import { PageDto, UpdateUserDto } from '../dtos/user.dto';
import {
  SaveContentDto,
  ContentPayloadDto,
  Author,
  CastcleContentQueryOptions,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  ContentResponse,
  ContentType,
  QuotePayload,
  RecastPayload
} from '../dtos/content.dto';
import { RevisionDocument } from '../schemas/revision.schema';
import {
  CastcleQueryOptions,
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility
} from '../dtos/common.dto';
import { CommentDto, UpdateCommentDto } from '../dtos/comment.dto';
import { CommentType } from '../schemas/comment.schema';

@Injectable()
export class ContentService {
  constructor(
    @InjectModel('Account') public _accountModel: Model<AccountDocument>,
    @InjectModel('Credential')
    public _credentialModel: CredentialModel,
    @InjectModel('User')
    public _userModel: Model<UserDocument>,
    @InjectModel('Content')
    public _contentModel: Model<ContentDocument>,
    @InjectModel('Revision')
    public _revisionModel: Model<RevisionDocument>,
    @InjectModel('Engagement')
    public _engagementModel: Model<EngagementDocument>,
    @InjectModel('Comment')
    public _commentModel: Model<CommentDocument>
  ) {}

  /**
   *
   * @param {UserDocument} user the user that create this content if contentDto has no author this will be author by default
   * @param {SaveContentDto} contentDto the content Dto that required for create a conent
   * @returns {ContentDocument} content.save() result
   */
  async createContentFromUser(user: UserDocument, contentDto: SaveContentDto) {
    let author: Author;
    if (!contentDto.author) author = this._getAuthorFromUser(user);
    else {
      const page = await this._userModel.findById(contentDto.author.id);
      author = this._getAuthorFromUser(page);
    }
    const newContent = {
      author: author,
      payload: contentDto.payload,
      revisionCount: 0,
      type: contentDto.type,
      visibility: EntityVisibility.Publish
    } as Content;
    const content = new this._contentModel(newContent);
    return content.save();
  }

  /**
   *
   * @param {string} id get content from content's id
   * @returns {ContentDocument}
   */
  getContentFromId = async (id: string) => {
    const content = await this._contentModel.findById(id).exec();
    if (content && content.visibility === EntityVisibility.Publish)
      return content;
    return null;
  };

  /**
   * Set content visibility to deleted
   * @param {string} id
   * @returns {ContentDocument}
   */
  deleteContentFromId = async (id: string) => {
    const content = await this._contentModel.findById(id).exec();
    content.visibility = EntityVisibility.Deleted;
    if (
      content.type === ContentType.Quote ||
      content.type === ContentType.Recast
    ) {
      const sourceContent = await this._contentModel
        .findById((content.payload as RecastPayload).source)
        .exec();
      const engagementType =
        content.type === ContentType.Quote
          ? EngagementType.Quote
          : EngagementType.Recast;
      const incEngagment: { [key: string]: number } = {};
      incEngagment[`engagements.${engagementType}.count`] = -1;
      //use update to byPass save hook to prevent recursive and revision api
      const updateResult = await this._contentModel
        .updateOne(
          { _id: sourceContent._id },
          {
            $inc: incEngagment
          }
        )
        .exec();
      //if update not success return false
      console.log(updateResult);
    }
    return content.save();
  };

  /**
   * update aggregator of recast/quote and get content status back to publish
   * @param {streieng} id of content
   * @returns {ContentDocument | null}
   */
  recoverContentFromId = async (id: string) => {
    const content = await this._contentModel.findById(id).exec();
    if (content.visibility !== EntityVisibility.Publish) {
      //recover engagement quote/recast
      if (
        content.type === ContentType.Quote ||
        content.type === ContentType.Recast
      ) {
        const sourceContent = await this._contentModel
          .findById((content.payload as RecastPayload).source)
          .exec();
        const engagementType =
          content.type === ContentType.Quote
            ? EngagementType.Quote
            : EngagementType.Recast;
        const incEngagment: { [key: string]: number } = {};
        incEngagment[`engagements.${engagementType}.count`] = 1;
        //use update to byPass save hook to prevent recursive and revision api
        const updateResult = await this._contentModel
          .updateOne(
            { _id: sourceContent._id },
            {
              $inc: incEngagment
            }
          )
          .exec();
        //if update not success return false
        console.log(updateResult);
      }
      content.visibility = EntityVisibility.Publish;
      return content.save();
    } else return null; //content already recover;
  };

  /**
   *
   * @param {string} id
   * @param {SaveContentDto} contentDto
   * @returns {ContentDocument}
   */
  updateContentFromId = async (id: string, contentDto: SaveContentDto) => {
    const content = await this._contentModel.findById(id).exec();
    content.payload = contentDto.payload;
    content.type = contentDto.type;
    return content.save();
  };

  /**
   * check content.author.id === user._id
   * @param {UserDocument} user
   * @param {ContentDocument} content
   * @returns {Promise<boolean>}
   */
  checkUserPermissionForEditContent = async (
    user: UserDocument,
    content: ContentDocument
  ) => content.author.id === user._id;

  /**
   *
   * @param {UserDocument} user
   * @param {CastcleQueryOptions} options contain option for sorting page = skip + 1,
   * @returns {Promise<{items:ContentDocument[], total:number, pagination: {Pagination}}>}
   */
  getContentsFromUser = async (
    user: UserDocument,
    options: CastcleContentQueryOptions = DEFAULT_CONTENT_QUERY_OPTIONS
  ) => {
    const findFilter: {
      'author.id': any;
      type?: string;
      visibility: EntityVisibility;
    } = {
      'author.id': user._id,
      visibility: EntityVisibility.Publish
    };
    if (options.type) findFilter.type = options.type;
    const query = this._contentModel
      .find(findFilter)
      .skip(options.page - 1)
      .limit(options.limit);
    const totalDocument = await this._contentModel.count(findFilter).exec();
    if (options.sortBy.type === 'desc') {
      return {
        total: totalDocument,
        items: await query.sort(`-${options.sortBy.field}`).exec(),
        pagination: createPagination(options, totalDocument)
      };
    } else
      return {
        total: totalDocument,
        items: await query.sort(`${options.sortBy.field}`).exec(),
        pagination: createPagination(options, totalDocument)
      };
  };

  getContentRevisions = async (content: ContentDocument) =>
    this._revisionModel
      .find({
        objectRef: {
          $ref: 'content',
          $id: content._id
        }
      })
      .exec();

  likeContent = async (content: ContentDocument, user: UserDocument) => {
    let engagement = await this._engagementModel.findOne({
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: content._id
      },
      type: EngagementType.Like
    });
    if (!engagement)
      engagement = new this._engagementModel({
        type: EngagementType.Like,
        user: user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id
        },
        visibility: EntityVisibility.Publish
      });
    engagement.type = EngagementType.Like;
    engagement.visibility = EntityVisibility.Publish;
    return engagement.save();
  };

  unLikeContent = async (content: ContentDocument, user: UserDocument) => {
    const engagement = await this._engagementModel
      .findOne({
        user: user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id
        },
        type: EngagementType.Like
      })
      .exec();
    if (!engagement) return null;
    return engagement.remove();
  };

  /**
   * get how many user like this content by populate user from engagement and filter it with user._id
   * @param {ContentDocument} content current content
   * @param {UserDocument} user current user
   * @returns {liked:boolean, participant:string[]}
   */
  getLikeParticipants = async (
    content: ContentDocument,
    user: UserDocument
  ) => {
    //get whether use is like
    const likeResult = await this._engagementModel
      .find({
        targetRef: {
          $ref: 'content',
          $id: content._id
        },
        type: EngagementType.Like,
        visibility: EntityVisibility.Publish
      })
      .populate('user')
      .exec();
    const liked = likeResult.find(
      (engagement) => engagement.user._id === user._id
    )
      ? true
      : false;
    const participants = likeResult.map((eng) => eng.user.displayName);
    return { liked, participants };
  };

  /**
   * transform User => Author object for create a content and use as DTO
   * @private
   * @param {UserDocument} user
   * @returns {Author}
   */
  _getAuthorFromUser = (user: UserDocument) => {
    const author: Author = {
      id: user._id,
      avatar:
        user.profile && user.profile.images && user.profile.images.avatar
          ? user.profile.images.avatar
          : null,
      castcleId: user.displayId,
      displayName: user.displayName,
      followed: false,
      type: user.type === UserType.Page ? UserType.Page : UserType.People,
      verified: user.verified ? true : false
    };
    return author;
  };

  quoteContentFromUser = async (
    content: ContentDocument,
    user: UserDocument,
    message?: string
  ) => {
    const author = this._getAuthorFromUser(user);
    const sourceContentId =
      content.type === ContentType.Recast || content.type === ContentType.Quote
        ? (content.payload as RecastPayload).source
        : content._id;
    const newContent = {
      author: author,
      payload: {
        source: sourceContentId,
        message: message
      } as QuotePayload,
      revisionCount: 0,
      type: ContentType.Quote
    } as Content;
    const quoteContent = await new this._contentModel(newContent).save();
    const engagement = await new this._engagementModel({
      type: EngagementType.Quote,
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: sourceContentId
      },
      visibility: EntityVisibility.Publish
    }).save();
    return { quoteContent, engagement };
  };

  recastContentFromUser = async (
    content: ContentDocument,
    user: UserDocument
  ) => {
    const author = this._getAuthorFromUser(user);
    const sourceContentId =
      content.type === ContentType.Recast || content.type === ContentType.Quote
        ? (content.payload as RecastPayload).source
        : content._id;
    const newContent = {
      author: author,
      payload: {
        source: sourceContentId
      } as RecastPayload,
      revisionCount: 0,
      type: ContentType.Recast
    } as Content;
    const recastContent = await new this._contentModel(newContent).save();
    const engagement = await new this._engagementModel({
      type: EngagementType.Recast,
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: sourceContentId
      },
      visibility: EntityVisibility.Publish
    }).save();
    return { recastContent, engagement };
  };

  /**
   * Get content this was meant to give to admin only
   * @param {CastcleContentQueryOptions} options
   * @returns
   */
  getContentsForAdmin = async (
    options: CastcleContentQueryOptions = DEFAULT_CONTENT_QUERY_OPTIONS
  ) => {
    const findFilter: {
      type?: string;
      visibility: EntityVisibility;
    } = {
      visibility: EntityVisibility.Publish
    };
    if (options.type) findFilter.type = options.type;
    const query = this._contentModel
      .find(findFilter)
      .skip(options.page - 1)
      .limit(options.limit);
    const totalDocument = await this._contentModel.count(findFilter).exec();
    if (options.sortBy.type === 'desc') {
      return {
        total: totalDocument,
        items: await query.sort(`-${options.sortBy.field}`).exec(),
        pagination: createPagination(options, totalDocument)
      };
    } else
      return {
        total: totalDocument,
        items: await query.sort(`${options.sortBy.field}`).exec(),
        pagination: createPagination(options, totalDocument)
      };
  };

  /**
   * Update Comment Engagement from Content or Comment
   * @param {CommentDocument} replyComment
   * @returns {true}
   */
  _updateCommentCounter = async (replyComment: CommentDocument) => {
    const incrementComment =
      replyComment.visibility === EntityVisibility.Publish ? 1 : -1;

    if (replyComment.type === CommentType.Reply) {
      await this._commentModel
        .updateOne(
          {
            _id: replyComment.targetRef.$id
              ? replyComment.targetRef.$id
              : replyComment.targetRef.oid
          },
          { $inc: { 'engagements.comment.count': incrementComment } }
        )
        .exec();
    } else if (replyComment.type === CommentType.Comment)
      await this._contentModel
        .updateOne(
          {
            _id: replyComment.targetRef.$id
              ? replyComment.targetRef.$id
              : replyComment.targetRef.oid
          },
          { $inc: { 'engagements.comment.count': incrementComment } }
        )
        .exec();
    return true;
  };

  /**
   * Creat a comment for content
   * @param {UserDocument} author
   * @param {ContentDocument} content
   * @param {UpdateCommentDto} updateCommentDto
   * @returns {Promise<CommentDocument>}
   */
  createCommentForContent = async (
    author: UserDocument,
    content: ContentDocument,
    updateCommentDto: UpdateCommentDto
  ) => {
    const newComment = new this._commentModel({
      author: author as User,
      message: updateCommentDto.message,
      targetRef: {
        $id: content._id,
        $ref: 'content'
      },
      type: CommentType.Comment
    } as CommentDto);

    const comment = await newComment.save();
    await this._updateCommentCounter(comment);
    return comment;
  };

  /**
   * Create a comment for comment(reply)
   * @param {UserDocument} author
   * @param {CommentDocument} rootComment
   * @param {UpdateCommentDto} updateCommentDto
   * @returns {Promise<CommentDocument>}
   */
  replyComment = async (
    author: UserDocument,
    rootComment: CommentDocument,
    updateCommentDto: UpdateCommentDto
  ) => {
    const newComment = new this._commentModel({
      author: author as User,
      message: updateCommentDto.message,
      targetRef: {
        $id: rootComment._id,
        $ref: 'comment'
      },
      type: CommentType.Reply
    } as CommentDto);
    const comment = await newComment.save();
    await this._updateCommentCounter(comment);
    return comment;
  };

  /**
   * Get Total Comment from content
   * @param {ContentDocument} content
   * @param {CastcleQueryOptions} options
   * @returns {total:number, items:CommentPayload[], pagination:Pagination}
   */
  getCommentsFromContent = async (
    content: ContentDocument,
    options: CastcleQueryOptions = DEFAULT_QUERY_OPTIONS
  ) => {
    const filter = {
      targetRef: {
        $id: content._id,
        $ref: 'content'
      },
      visibility: EntityVisibility.Publish
    };
    const rootComments = await this._commentModel
      .find(filter)
      .limit(options.limit)
      .skip(options.page - 1)
      .sort(
        `${options.sortBy.type === 'desc' ? '-' : ''}${options.sortBy.field}`
      )
      .exec();
    const totalDocument = await this._commentModel.count(filter).exec();
    const payloads = await Promise.all(
      rootComments.map((comment) =>
        comment.toCommentPayload(this._commentModel)
      )
    );
    return {
      total: totalDocument,
      items: payloads,
      pagination: createPagination(options, totalDocument)
    };
  };

  /**
   *
   * @param {CommentDocument} rootComment
   * @param {UpdateCommentDto} updateCommentDto
   * @returns {CommentDocument}
   */
  updateComment = async (
    rootComment: CommentDocument,
    updateCommentDto: UpdateCommentDto
  ) => {
    const comment = await this._commentModel.findById(rootComment._id);
    comment.message = updateCommentDto.message;
    return comment.save();
  };

  /**
   *
   * @param {CommentDocument} rootComment
   * @returns {CommentDocument}
   */
  deleteComment = async (rootComment: CommentDocument) => {
    const comment = await this._commentModel.findById(rootComment._id);
    comment.visibility = EntityVisibility.Deleted;
    const result = comment.save();
    await this._updateCommentCounter(comment);
    return result;
  };

  /**
   * Update Engagement.like of the comment
   * @param {UserDocument} user
   * @param {CommentDocument} comment
   * @returns  {EngagementDocument}
   */
  likeComment = async (user: UserDocument, comment: CommentDocument) => {
    let engagement = await this._engagementModel.findOne({
      user: user._id,
      targetRef: {
        $ref: 'comment',
        $id: comment._id
      },
      type: EngagementType.Like
    });
    if (!engagement)
      engagement = new this._engagementModel({
        type: EngagementType.Like,
        user: user._id,
        targetRef: {
          $ref: 'comment',
          $id: comment._id
        },
        visibility: EntityVisibility.Publish
      });
    engagement.type = EngagementType.Like;
    engagement.visibility = EntityVisibility.Publish;
    return engagement.save();
  };

  /**
   * Update Engagement.like of the comment
   * @param {UserDocument} user
   * @param {CommentDocument} comment
   * @returns  {EngagementDocument}
   */
  unlikeComment = async (user: UserDocument, comment: CommentDocument) => {
    const engagement = await this._engagementModel
      .findOne({
        user: user._id,
        targetRef: {
          $ref: 'comment',
          $id: comment._id
        },
        type: EngagementType.Like
      })
      .exec();
    if (!engagement) return null;
    return engagement.remove();
  };

  /**
   * get content by id that visibilty = equal true
   * @param commentId
   * @returns
   */
  getCommentById = async (commentId: string) =>
    this._commentModel
      .findOne({ _id: commentId, visibility: EntityVisibility.Publish })
      .exec();
}
