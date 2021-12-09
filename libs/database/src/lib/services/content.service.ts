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

import { FilterQuery, Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AccountDocument } from '../schemas/account.schema';
import { CommentDocument, CredentialModel } from '../schemas';
import { User, UserDocument, UserType } from '../schemas/user.schema';
import {
  ContentDocument,
  Content,
  toSignedContentPayloadItem
} from '../schemas/content.schema';
import {
  EngagementDocument,
  EngagementType
} from '../schemas/engagement.schema';
import {
  createCastcleFilter,
  createCastcleMeta,
  createPagination
} from '../utils/common';
import {
  SaveContentDto,
  Author,
  CastcleContentQueryOptions,
  DEFAULT_CONTENT_QUERY_OPTIONS,
  ContentType,
  ShortPayload
} from '../dtos/content.dto';
import { RevisionDocument } from '../schemas/revision.schema';
import {
  CastcleIncludes,
  CastcleQueryOptions,
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility
} from '../dtos/common.dto';
import {
  CommentDto,
  CommentsReponse,
  UpdateCommentDto
} from '../dtos/comment.dto';
import { CommentType } from '../schemas/comment.schema';
import { FeedItemDocument } from '../schemas/feedItem.schema';
import { FeedItemDto } from '../dtos/feedItem.dto';
import { ContentAggregator } from '../aggregator/content.aggregator';
import { HashtagService } from './hashtag.service';
import {
  GuestFeedItemDocument,
  GuestFeedItemType
} from '../schemas/guestFeedItems.schema';
import {
  GuestFeedItemDto,
  GuestFeedItemPayload,
  GuestFeedItemPayloadItem
} from '../dtos/guestFeedItem.dto';
import { QueryOption } from '../dtos/common.dto';
import { Environment } from '@castcle-api/environments';
import { CastcleException } from '@castcle-api/utils/exception';
import { CastLogger } from '@castcle-api/logger';
import { createTransport } from 'nodemailer';

@Injectable()
export class ContentService {
  private logger = new CastLogger(ContentService.name);
  private transporter = createTransport({
    host: Environment.SMTP_HOST,
    port: Environment.SMTP_PORT,
    secure: true,
    auth: {
      user: Environment.SMTP_USERNAME,
      pass: Environment.SMTP_PASSWORD
    }
  });

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
    public _commentModel: Model<CommentDocument>,
    @InjectModel('FeedItem')
    public _feedItemModel: Model<FeedItemDocument>,
    public hashtagService: HashtagService,
    @InjectModel('GuestFeedItem')
    public _guestFeedItemModel: Model<GuestFeedItemDocument>
  ) {}

  /**
   *
   * @param {UserDocument} user the user that create this content if contentDto has no author this will be author by default
   * @param {SaveContentDto} contentDto the content Dto that required for create a content
   * @returns {ContentDocument} content.save() result
   */
  async createContentFromUser(user: UserDocument, contentDto: SaveContentDto) {
    /*if (!contentDto.author) author = this._getAuthorFromUser(user);
    else {
      const page = await this._userModel.findById(contentDto.author.id);
      author = this._getAuthorFromUser(page);
    }*/
    const author = this._getAuthorFromUser(user);
    const hashtags = this.hashtagService.extractHashtagFromContentPayload(
      contentDto.payload
    );
    //create hashtag
    await this.hashtagService.createFromTags(hashtags);
    const newContent = {
      author: author,
      payload: contentDto.payload,
      revisionCount: 0,
      type: contentDto.type,
      visibility: EntityVisibility.Publish,
      hashtags: hashtags
    } as Content;
    const content = new this._contentModel(newContent);

    return content.save();
  }

  /**
   *
   * @param {Author} author the user that create this content
   * @param {SaveContentDto[]} contentsDtos contents to save
   * @returns {ContentDocument[]} saved contents
   */
  async createContentsFromAuthor(
    author: Author,
    contentsDtos: SaveContentDto[]
  ): Promise<ContentDocument[]> {
    const contentsToCreate = contentsDtos.map(async ({ payload, type }) => {
      const hashtags =
        this.hashtagService.extractHashtagFromContentPayload(payload);

      await this.hashtagService.createFromTags(hashtags);

      return {
        author,
        payload,
        revisionCount: 0,
        type,
        visibility: EntityVisibility.Publish,
        hashtags: hashtags
      } as Content;
    });

    const contents = await Promise.all(contentsToCreate);

    return this._contentModel.create(contents);
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
    //remove engagement
    if (content.isRecast || content.isQuote) {
      const engagement = await this._engagementModel
        .findOne({ itemId: content._id })
        .exec();
      await engagement.remove();
    }
    if (content.hashtags) {
      this.hashtagService.removeFromTags(content.hashtags);
    }
    console.debug('*********deleteContentFromId', id);
    return content.save();
  };

  /**
   * update aggregator of recast/quote and get content status back to publish
   * @param {string} id of content
   * @returns {ContentDocument | null}
   */
  recoverContentFromId = async (id: string) => {
    const content = await this._contentModel.findById(id).exec();
    if (content.visibility !== EntityVisibility.Publish) {
      //recover engagement quote/recast
      if (content.isQuote || content.isRecast) {
        const sourceContent = await this._contentModel
          .findById(content.originalPost)
          .exec();
        const engagementType = content.isQuote
          ? EngagementType.Quote
          : EngagementType.Recast;
        const incEngagement: { [key: string]: number } = {};
        incEngagement[`engagements.${engagementType}.count`] = 1;
        //use update to byPass save hook to prevent recursive and revision api
        const updateResult = await this._contentModel
          .updateOne(
            { _id: sourceContent._id },
            {
              $inc: incEngagement
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
    const newHashtags = this.hashtagService.extractHashtagFromContentPayload(
      contentDto.payload
    );
    //TODO !!! need to improve performance
    await this.hashtagService.updateFromTags(newHashtags, content.hashtags);
    content.hashtags = this.hashtagService.extractHashtagFromContentPayload(
      contentDto.payload
    );
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
    let findFilter: any = {
      'author.id': user._id,
      visibility: EntityVisibility.Publish
    };
    if (options.type) findFilter.type = options.type;
    findFilter = await createCastcleFilter(
      findFilter,
      options,
      this._contentModel
    );
    const query = this._contentModel.find(findFilter).limit(options.maxResults);
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

  getContentEngagement = async (
    content: ContentDocument,
    engagementType: EngagementType,
    user: UserDocument
  ) => {
    const engagement = await this._engagementModel
      .findOne({
        user: user._id,
        targetRef: {
          $ref: 'content',
          $id: content._id
        },
        type: engagementType,
        visibility: EntityVisibility.Publish
      })
      .exec();
    return engagement;
  };

  getCommentEnagement = async (
    comment: CommentDocument,
    engagementType: EngagementType,
    user: UserDocument
  ) => {
    const engagement = await this._engagementModel
      .findOne({
        user: user._id,
        targetRef: {
          $ref: 'comment',
          $id: comment._id
        },
        type: engagementType,
        visibility: EntityVisibility.Publish
      })
      .exec();
    return engagement;
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
      avatar: user.profile?.images?.avatar || null,
      castcleId: user.displayId,
      displayName: user.displayName,
      followed: false,
      type: user.type === UserType.Page ? UserType.Page : UserType.People,
      verified: user.verified
    };
    return author;
  };

  /**
   * Create a short content from other content
   * @param {ContentDocument} content
   * @param {UserDocument} user
   * @param {string} message
   * @returns {ContentDocument, EngagementDocument}
   */
  quoteContentFromUser = async (
    content: ContentDocument,
    user: UserDocument,
    message?: string
  ) => {
    const author = this._getAuthorFromUser(user);
    const sourceContentId =
      content.isRecast || content.isQuote
        ? content.originalPost._id
        : content._id;
    /*const sourceContentId =
      content.type === ContentType.Recast || content.type === ContentType.Quote
        ? (content.payload as RecastPayload).source
        : content._id;*/
    const newContent = {
      author: author,
      payload: {
        message: message
      } as ShortPayload,
      revisionCount: 0,
      type: ContentType.Short,
      isQuote: true,
      originalPost:
        content.isQuote || content.isRecast ? content.originalPost : content
    } as Content;
    const quoteContent = await new this._contentModel(newContent).save();
    const engagement = await new this._engagementModel({
      type: EngagementType.Quote,
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: sourceContentId
      },
      itemId: quoteContent._id,
      visibility: EntityVisibility.Publish
    }).save();
    return { quoteContent, engagement };
  };

  /**
   * Recast a content
   * @param {ContentDocument} content
   * @param {UserDocument} user
   * @returns {ContentDocument, EngagementDocument}
   */
  recastContentFromUser = async (
    content: ContentDocument,
    user: UserDocument
  ) => {
    const author = this._getAuthorFromUser(user);
    const sourceContentId =
      content.isRecast || content.isQuote
        ? content.originalPost._id
        : content._id;
    /*const sourceContentId =
      content.is === ContentType.Recast || content.type === ContentType.Quote
        ? (content.payload as RecastPayload).source
        : content._id;*/
    const newContent = {
      author: author,
      payload: {} as ShortPayload,
      revisionCount: 0,
      type: ContentType.Short,
      originalPost:
        content.isQuote || content.isRecast ? content.originalPost : content,
      isRecast: true
    } as Content;
    const recastContent = await new this._contentModel(newContent).save();
    const engagement = await new this._engagementModel({
      type: EngagementType.Recast,
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: sourceContentId
      },
      itemId: recastContent._id,
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
    let findFilter: any = {
      visibility: EntityVisibility.Publish
    };
    if (options.type) findFilter.type = options.type;
    findFilter = await createCastcleFilter(
      findFilter,
      options,
      this._contentModel
    );
    const query = this._contentModel.find(findFilter).limit(options.maxResults);
    const items =
      options.sortBy.type === 'desc'
        ? await query.sort(`-${options.sortBy.field}`).exec()
        : await query.sort(`${options.sortBy.field}`).exec();
    return {
      items,
      includes: new CastcleIncludes({
        users: items.map(({ author }) => author)
      }),
      meta: createCastcleMeta(items)
    };
  };

  /**
   * Update Comment Engagement from Content or Comment
   * @param {CommentDocument} replyComment
   * @returns {true}
   */
  _updateCommentCounter = async (
    replyComment: CommentDocument,
    commentByUserId?: any
  ) => {
    if (replyComment.type === CommentType.Reply) {
      if (replyComment.visibility === EntityVisibility.Publish)
        await new this._engagementModel({
          type: EngagementType.Comment,
          targetRef: {
            $ref: 'comment',
            $id: replyComment.targetRef.$id
              ? replyComment.targetRef.$id
              : replyComment.targetRef.oid
          },
          visibility: EntityVisibility.Publish,
          user: commentByUserId
        }).save();
      else {
        const engagements = await this._engagementModel
          .find({
            type: EngagementType.Comment,
            targetRef: {
              $ref: 'comment',
              $id: replyComment.targetRef.$id
                ? replyComment.targetRef.$id
                : replyComment.targetRef.oid
            }
          })
          .exec();
        await Promise.all(engagements.map((e) => e.remove()));
      }
    } else if (replyComment.type === CommentType.Comment)
      if (replyComment.visibility === EntityVisibility.Publish)
        await new this._engagementModel({
          type: EngagementType.Comment,
          targetRef: {
            $ref: 'content',
            $id: replyComment.targetRef.$id
              ? replyComment.targetRef.$id
              : replyComment.targetRef.oid
          },
          visibility: EntityVisibility.Publish,
          user: commentByUserId
        }).save();
      else {
        const engagements = await this._engagementModel
          .find({
            type: EngagementType.Comment,
            targetRef: {
              $ref: 'content',
              $id: replyComment.targetRef.$id
                ? replyComment.targetRef.$id
                : replyComment.targetRef.oid
            }
          })
          .exec();
        await Promise.all(engagements.map((e) => e.remove()));
      }
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
    const dto = {
      author: author as User,
      message: updateCommentDto.message,
      targetRef: {
        $id: content._id,
        $ref: 'content'
      },
      type: CommentType.Comment
    } as CommentDto;
    const newComment = new this._commentModel(dto);
    newComment.hashtags = this.hashtagService.extractHashtagFromCommentDto(dto);
    await this.hashtagService.createFromTags(newComment.hashtags);
    const comment = await newComment.save();
    await this._updateCommentCounter(comment, author._id);
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
    const dto = {
      author: author as User,
      message: updateCommentDto.message,
      targetRef: {
        $id: rootComment._id,
        $ref: 'comment'
      },
      type: CommentType.Reply
    } as CommentDto;
    const newComment = new this._commentModel(dto);
    newComment.hashtags = this.hashtagService.extractHashtagFromCommentDto(dto);
    await this.hashtagService.createFromTags(newComment.hashtags);
    const comment = await newComment.save();
    await this._updateCommentCounter(comment, author._id);
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
  ): Promise<CommentsReponse> => {
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
    const engagements = await this._engagementModel.find({
      targetRef: {
        $in: rootComments.map((rComment) => ({
          $ref: 'comment',
          $id: rComment._id
        }))
      }
    });
    const payloads = await Promise.all(
      rootComments.map((comment) =>
        comment.toCommentPayload(this._commentModel, engagements)
      )
    );
    return {
      payload: payloads,
      meta: createCastcleMeta(rootComments)
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
    const session = this._accountModel.startSession();
    const comment = await this._commentModel.findById(rootComment._id);
    comment.message = updateCommentDto.message;
    const tags = this.hashtagService.extractHashtagFromText(
      updateCommentDto.message
    );
    await this.hashtagService.updateFromTags(tags, comment.hashtags);
    comment.hashtags = tags;
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
    if (comment.hashtags)
      await this.hashtagService.removeFromTags(comment.hashtags);
    this._updateCommentCounter(comment);
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
   * get content by id that visibility = equal true
   * @param commentId
   * @returns
   */
  getCommentById = async (commentId: string) =>
    this._commentModel
      .findOne({ _id: commentId, visibility: EntityVisibility.Publish })
      .exec();

  /**
   * Get all engagement that this user engage to content (like, cast, recast, quote)
   * @param {ContentDocument} content
   * @param {UserDocument} user
   * @returns {EngagementDocument[]}
   */
  getAllEngagementFromContentAndUser = async (
    content: ContentDocument,
    user: UserDocument
  ) =>
    this._engagementModel
      .find({
        targetRef: { $ref: 'content', $id: content._id },
        user: user._id
      })
      .exec();

  /**
   * Get all engagement that this user engage to contents (like, cast, recast, quote)
   * @param {ContentDocument[]} contents
   * @param {UserDocument} user
   * @returns {EngagementDocument[]}
   */
  getAllEngagementFromContentsAndUser = async (
    contents: ContentDocument[],
    user: UserDocument
  ) => {
    const contentIds = contents.map((c) => c._id);
    console.debug('contentIds', contentIds);
    return this.getAllEngagementFromContentIdsAndUser(contentIds, user);
  };

  /**
   *
   * @param contentIds
   * @param user
   * @returns
   */
  getAllEngagementFromContentIdsAndUser = async (
    contentIds: any[],
    user: UserDocument
  ) => {
    return this._engagementModel
      .find({
        targetRef: {
          $in: contentIds.map((id) => ({
            $ref: 'content',
            $id: id
          }))
        },
        user: user._id
      })
      .exec();
  };

  /**
   * Get all engagement that this user engage to comment (like, cast, recast, quote)
   * @param {CommentDocument} comment
   * @param {UserDocument} user
   * @returns  {EngagementDocument[]}
   */
  getAllEngagementFromCommentAndUser = async (
    comment: CommentDocument,
    user: UserDocument
  ) =>
    this._engagementModel
      .find({
        targetRef: { $ref: 'comment', $id: comment._id },
        user: user._id
      })
      .exec();

  /**
   *
   * @param {UserDocument} author
   * @param {UserDocument} viewer
   * @returns {Promise<FeedItemDocument[]>}
   */
  createFeedItemFromAuthorToViewer = async (
    author: UserDocument,
    viewer: UserDocument
  ) => {
    const contents = await this._contentModel
      .find({ 'author.id': author._id, visibility: EntityVisibility.Publish })
      .exec();
    const promisesFeedItem = contents.map((content) =>
      new this._feedItemModel({
        seen: false,
        called: false,
        viewer: viewer,
        content: content.toContentPayload(),
        aggregator: {
          createTime: new Date(),
          following: true
        } as ContentAggregator
      } as FeedItemDto).save()
    );
    return await Promise.all(promisesFeedItem);
  };

  /**
   * Convert content => feedItem to group of viewers
   * @param {ContentDocument} content
   * @param {AccountDocument[]} viewers
   * @returns {Promise<FeedItemDocument[]>}
   */
  _createFeedItemFromAuthorToViewers = async (
    content: ContentDocument,
    viewers: AccountDocument[]
  ) => {
    const promisesFeedItem = viewers.map((viewer) => {
      return new this._feedItemModel({
        seen: false,
        called: false,
        viewer: viewer,
        content: content.toUnsignedContentPayload(),
        aggregator: {
          createTime: new Date(),
          following: true
        } as ContentAggregator
      } as FeedItemDto).save();
    });
    const result = await Promise.all(promisesFeedItem);
    console.debug('result feed ', result);
    return result;
  };

  /**
   * Create a feed item to every user in the system
   * @param {ContentDocument} content
   * @returns {Promise<FeedItemDocument[]>}
   */
  createFeedItemFromAuthorToEveryone = async (content: ContentDocument) => {
    //TODO !!! should do pagination later on
    const viewers = await this._accountModel.find().exec();
    console.debug('publish to ', viewers);
    return this._createFeedItemFromAuthorToViewers(content, viewers);
  };

  /**
   * Create a feed item to every user in the system
   * @param {ObjectId} contentId
   * @returns {Promise<FeedItemDocument[]>}
   */
  createFeedItemFromAuthorIdToEveryone = async (contentId: any) => {
    const content = await this._contentModel.findById(contentId).exec();
    console.debug('create feed with content', content);
    return this.createFeedItemFromAuthorToEveryone(content);
  };

  /**
   *
   * @param {ObjectId} authorId
   * @param {ObjectId}  viewerId
   * @returns {Promise<FeedItemDocument[]>}
   */
  createFeedItemFromAuthorIdToViewerId = async (
    authorId: any,
    viewerId: any
  ) => {
    const author = await this._userModel.findById(authorId).exec();
    const viewer = await this._userModel.findById(viewerId).exec();
    return this.createFeedItemFromAuthorToViewer(author, viewer);
  };

  /**
   *
   * @param contentId
   * @returns {GuestFeedItemDocument}
   */
  createGuestFeedItemFromAuthorId = async (contentId: any) => {
    const newGuestFeedItem = new this._guestFeedItemModel({
      score: 0,
      type: GuestFeedItemType.Content,
      content: contentId
    } as GuestFeedItemDto);
    return newGuestFeedItem.save();
  };

  /**
   * Get guestFeedItem according to accountCountry code  if have sinceId it will query all feed after sinceId
   * @param {QueryOption} query
   * @param {string} accountCountryCode
   * @returns {GuestFeedItemDocument[]}
   */
  getGuestFeedItems = async (
    query: QueryOption,
    accountCountryCode?: string
  ) => {
    const filter: FilterQuery<GuestFeedItemDocument> = {
      countryCode: accountCountryCode.toLowerCase() ?? 'en'
    };
    if (query.sinceId) {
      const guestFeedItemSince = await this._guestFeedItemModel
        .findById(query.sinceId)
        .exec();
      filter.createdAt = {
        $gt: new Date(guestFeedItemSince.createdAt)
      };
    } else if (query.untilId) {
      const guestFeedItemUntil = await this._guestFeedItemModel
        .findById(query.untilId)
        .exec();
      filter.createdAt = {
        $lt: new Date(guestFeedItemUntil.createdAt)
      };
    }
    const documents = await this._guestFeedItemModel
      .find(filter)
      .populate('content')
      .limit(query.maxResults)
      .sort({ score: -1, createdAt: -1 })
      .exec();

    return {
      payload: documents.map(
        (item) =>
          ({
            id: item.id,
            feature: {
              slug: 'feed',
              key: 'feature.feed',
              name: 'Feed'
            },
            circle: {
              id: 'for-you',
              key: 'circle.forYou',
              name: 'For You',
              slug: 'forYou'
            },
            payload: toSignedContentPayloadItem(item.content),
            type: 'content'
          } as GuestFeedItemPayloadItem)
      ),
      includes: new CastcleIncludes({
        users: documents.map((item) => item.content.author)
      }),
      meta: createCastcleMeta(documents)
    } as GuestFeedItemPayload;
  };

  async reportContent(
    user: UserDocument,
    content: ContentDocument,
    message: string
  ) {
    if (!content) throw CastcleException.CONTENT_NOT_FOUND;

    const engagementFilter = {
      user: user._id,
      targetRef: { $ref: 'content', $id: content._id },
      type: EngagementType.Report
    };

    await this._engagementModel
      .updateOne(
        engagementFilter,
        { ...engagementFilter, visibility: EntityVisibility.Publish },
        { upsert: true }
      )
      .exec();

    const mail = await this.transporter.sendMail({
      from: 'castcle-noreply" <no-reply@castcle.com>',
      subject: `Report content: ${content._id}`,
      to: Environment.SMTP_ADMIN_EMAIL,
      text: `Content: ${content._id} has been reported.
Author: ${content.author.displayName} (${content.author.id})
Body: ${JSON.stringify(content.payload, null, 2)}

ReportedBy: ${user.displayName} (${user._id})
Message: ${message}`
    });

    this.logger.log(`Report has been submitted ${mail.messageId}`);
  }
}
