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

import { CastcleLogger, LocalizationLang } from '@castcle-api/common';
import { CacheStore, Environment } from '@castcle-api/environments';
import { CastcleImage } from '@castcle-api/utils/aws';
import { Mailer } from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Cache } from 'cache-manager';
import cdf from 'castcle-cdf';
import { DBRef } from 'mongodb';
import { AnyKeys, Model, Types } from 'mongoose';
import {
  Author,
  CastcleIncludes,
  CreateContentDto,
  EntityVisibility,
  GetSearchQuery,
  Meta,
  NotificationSource,
  NotificationType,
  PaginationQuery,
  Participates,
  ReportContentDto,
  ResponseDto,
  ResponseParticipate,
  ShortPayload,
  UserField,
} from '../dtos';
import {
  CAccountNo,
  ContentFarmingStatus,
  ContentFlowItem,
  ContentMessage,
  ContentMessageEvent,
  ContentType,
  EngagementType,
  GetContentPayload,
  MetadataType,
  OwnerContentResponse,
  PublicContentResponse,
  QueueName,
  ReferencedTypeCast,
  ReportingAction,
  ReportingIllegal,
  ReportingMessage,
  ReportingStatus,
  ReportingType,
  TransactionStatus,
  TransactionType,
  UserType,
  WalletType,
} from '../models';
import {
  ContentFarmingCDF,
  ContentFarmingResponse,
} from '../models/content-farming.model';
import { Repository } from '../repositories';
import {
  Account,
  Content,
  ContentFarming,
  User,
  toUnsignedContentPayloadItem,
} from '../schemas';
import { createCastcleFilter } from '../utils/common';
import { DataService } from './data.service';
import { HashtagService } from './hashtag.service';
import { NotificationServiceV2 } from './notification.service.v2';
import { TAccountService } from './taccount.service';
import { UserServiceV2 } from './user.service.v2';

@Injectable()
export class ContentServiceV2 {
  private logger = new CastcleLogger(ContentServiceV2.name);
  constructor(
    @InjectModel('ContentFarming')
    private contentFarmingModel: Model<ContentFarming>,
    @InjectModel('Content')
    private contentModel: Model<Content>,
    @InjectQueue(QueueName.CONTENT)
    private contentQueue: Queue<ContentMessage>,
    @InjectQueue(QueueName.REPORTING)
    private reportingQueue: Queue<ReportingMessage>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private notificationService: NotificationServiceV2,
    private tAccountService: TAccountService,
    private repository: Repository,
    private hashtagService: HashtagService,
    private dataService: DataService,
    private userServiceV2: UserServiceV2,
    private mailerService: Mailer,
  ) {}

  private signContentImages(images: CastcleImage[]) {
    return images?.map((image: CastcleImage) => CastcleImage.sign(image));
  }

  toContentOwnerPayload(
    content: GetContentPayload,
    participate?: Participates,
    farmingCount?: number,
  ): OwnerContentResponse {
    return {
      id: content._id,
      authorId: content.authorId,
      type: content.type,
      message: (content.payload as ShortPayload)?.message,
      link: (content.payload as ShortPayload)?.link
        ? this.signContentImages(
            ((content.payload as ShortPayload)?.link.map(
              ({ image }) => image,
            ) as CastcleImage[]) ?? [],
          )
        : undefined,
      photo: {
        contents: this.signContentImages(
          ((content.payload as ShortPayload)?.photo
            ?.contents as CastcleImage[]) ?? [],
        ),
      },
      metrics: { ...content.metrics, farmCount: farmingCount || 0 },
      participate: {
        liked: participate?.liked ?? false,
        commented: participate?.commented ?? false,
        quoted: participate?.quoted ?? false,
        recasted: participate?.recasted ?? false,
        reported: participate?.reported ?? false,
        farming: participate?.farming ?? false,
      },
      referencedCasts:
        content.isRecast || content.isQuote
          ? {
              type: content.isRecast
                ? ReferencedTypeCast.Recasted
                : ReferencedTypeCast.Quoted,
              id: content.originalPost?._id,
            }
          : undefined,
      reportedStatus: content.reportedStatus,
      reportedSubject: content.reportedSubject,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }

  toContentPublishPayload(
    content: GetContentPayload,
    participate?: Participates,
    farmingCount?: number,
  ): PublicContentResponse {
    return {
      id: content._id,
      authorId: content.authorId,
      type: content.type,
      message: (content.payload as ShortPayload)?.message,
      link: (content.payload as ShortPayload)?.link
        ? (content.payload as ShortPayload)?.link.map((link) => {
            if (!link?.image) return link;
            return CastcleImage.sign(link.image as CastcleImage);
          })
        : undefined,
      photo: {
        contents: this.signContentImages(
          ((content.payload as ShortPayload)?.photo
            ?.contents as CastcleImage[]) ?? [],
        ),
      },
      metrics: { ...content.metrics, farmCount: farmingCount || 0 },
      participate: {
        liked: participate?.liked ?? false,
        commented: participate?.commented ?? false,
        quoted: participate?.quoted ?? false,
        recasted: participate?.recasted ?? false,
        reported: participate?.reported ?? false,
        farming: participate?.farming ?? false,
      },
      referencedCasts:
        content.isRecast || content.isQuote
          ? {
              type: content.isRecast
                ? ReferencedTypeCast.Recasted
                : ReferencedTypeCast.Quoted,
              id: content.originalPost?._id,
            }
          : undefined,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }

  async convertContentToResponses(
    contents: GetContentPayload[],
    userId?: string,
    userFields?: UserField[],
    isOwner?: boolean,
  ) {
    this.logger.log('#convertContentToResponses:start');
    const contentRef = contents.map(
      (content) => new DBRef('content', new Types.ObjectId(content?._id)),
    );

    this.logger.log('#convertContentToResponses:prepare');

    const [originalPostRef, originalAuthorIds, authorIds] = [
      contents
        .filter(({ originalPost }) => originalPost)
        .map(
          ({ originalPost }) =>
            new DBRef('content', new Types.ObjectId(originalPost._id)),
        ),
      contents
        .filter(({ originalPost }) => originalPost)
        .map(({ originalPost }) => originalPost?.authorId),
      contents.map(({ authorId }) => authorId),
    ];

    this.logger.log('#convertContentToResponses:more');

    const [casts, authors, participates, relationships, farmsAmount] =
      await Promise.all([
        contents
          .filter(({ originalPost }) => originalPost)
          .map(({ originalPost }) => originalPost),
        originalAuthorIds
          ? await this.repository.findUsers({
              _id: [...originalAuthorIds, ...authorIds],
            })
          : [],
        userId
          ? this.repository.aggregationParticipates({
              targetRef: [...originalPostRef, ...contentRef],
              userId: new Types.ObjectId(userId) as any,
            })
          : [],
        this.repository.findRelationships({
          userId: new Types.ObjectId(userId),
          followedUser: [...originalAuthorIds, ...authorIds],
        }),
        this.repository.aggregationGetFarmAmount({
          content: [
            ...contents.map((content) => new Types.ObjectId(content._id)),
            ...contents.map(
              ({ originalPost }) => new Types.ObjectId(originalPost?._id),
            ),
          ],
          status: ContentFarmingStatus.Farming,
        }),
      ]);

    this.logger.log('#convertContentToResponses:payload');

    const [payloadContents, includeCasts, includeUsers] = [
      contents
        .filter((content) =>
          authors.find(
            (author) => String(author.id) === String(content.authorId),
          ),
        )
        .map((content) => {
          const participate = userId
            ? participates.find(
                ({ _id }) => String(_id) === String(content._id),
              )
            : undefined;

          const farmAmount = Number(
            farmsAmount.find(
              (farm) => String(farm.contentId) === String(content._id),
            )?.farmAmount,
          );

          return isOwner
            ? this.toContentOwnerPayload(content, participate, farmAmount)
            : this.toContentPublishPayload(content, participate, farmAmount);
        }),
      casts?.map((cast) => {
        const participate = userId
          ? participates?.find(({ _id }) => String(_id) === String(userId))
          : undefined;

        const farmAmount = Number(
          farmsAmount.find(
            (farm) => String(farm.contentId) === String(cast._id),
          )?.farmAmount,
        );

        return isOwner
          ? this.toContentOwnerPayload(cast, participate, farmAmount)
          : this.toContentPublishPayload(cast, participate, farmAmount);
      }),
      authors.map((author) => {
        const relationship = relationships?.find(
          ({ followedUser }) => String(followedUser) === String(author.id),
        );

        return new Author({
          id: author.id,
          avatar: author.profile?.images?.avatar,
          castcleId: author.displayId,
          displayName: author.displayName,
          type: author.type,
          verified: author.verified,
        }).toIncludeUser(
          userFields?.includes(UserField.Relationships) || userId
            ? {
                blocked: relationship?.blocking ?? false,
                followed: relationship?.following ?? false,
              }
            : {},
        );
      }),
    ];

    this.logger.log('#convertContentToResponses:success');

    return {
      payloadContents,
      includeCasts,
      includeUsers,
    };
  }

  sortContentsByScore = async (
    accountId: string,
    contents: GetContentPayload[],
  ) => {
    const contentIds = contents.map((content) => content._id);
    const score = await this.dataService.personalizeContents(
      accountId,
      contentIds,
    );

    return score;
  };

  likeCast = async (contentId: string, user: User, account: Account) => {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');
    const engagement = await this.repository.findEngagement({
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
      type: EngagementType.Like,
    });

    if (engagement) throw new CastcleException('LIKE_IS_EXIST');

    const newEngagement = await this.repository.createEngagement({
      type: EngagementType.Like,
      user: user._id,
      account: user.ownerAccount,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
      visibility: EntityVisibility.Publish,
    });

    const userOwner = await this.repository.findUser({
      _id: content.author.id,
    });

    if (userOwner && String(user._id) !== String(content.author.id))
      await this.notificationService.notifyToUser(
        {
          source:
            userOwner.type === UserType.PEOPLE
              ? NotificationSource.Profile
              : NotificationSource.Page,
          sourceUserId: user._id,
          type: NotificationType.Like,
          contentRef: content._id,
          account: userOwner.ownerAccount,
          read: false,
        },
        userOwner,
        account.preferences.languages[0],
      );
    return { content, engagement: newEngagement };
  };

  unlikeCast = async (contentId: string, user: User) => {
    const engagement = await this.repository.findEngagement({
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: new Types.ObjectId(contentId),
      },
      type: EngagementType.Like,
    });

    if (!engagement) return;
    await this.repository.updateNotification(
      {
        type: NotificationType.Like,
        contentRef: new Types.ObjectId(contentId),
        commentRef: { $exists: false },
        replyRef: { $exists: false },
      },
      {
        $pull: { sourceUserId: { $eq: user._id } },
      },
    );
    const notification = await this.repository.findNotification({
      type: NotificationType.Like,
      contentRef: new Types.ObjectId(contentId),
      commentRef: { $exists: false },
      replyRef: { $exists: false },
    });

    if (notification && !notification?.sourceUserId?.length)
      await notification.remove();

    return engagement.remove();
  };

  getRecastPipeline = async (contentId: string, user: User) => {
    const contents = await this.repository.aggregationContentsV2({
      viewer: user,
      _id: contentId,
      isRecast: true,
    });

    const { payloadContents, includeUsers, includeCasts } =
      await this.convertContentToResponses(contents, user.id, [], true);

    return ResponseDto.ok({
      payload: payloadContents[0],
      includes: new CastcleIncludes({
        users: includeUsers,
        casts: includeCasts,
      }),
    });
  };

  getQuoteCastPipeline = async (contentId: string, user: User) => {
    const contents = await this.repository.aggregationContentsV2({
      viewer: user,
      _id: contentId,
      isQuote: true,
    });

    const { payloadContents, includeUsers, includeCasts } =
      await this.convertContentToResponses(contents, user.id, [], true);

    return ResponseDto.ok({
      payload: payloadContents[0],
      includes: new CastcleIncludes({
        users: includeUsers,
        casts: includeCasts,
      }),
    });
  };

  recast = async (contentId: string, user: User, account: Account) => {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const originalContent = await this.repository.findContent({
      originalPost: contentId,
      author: user._id,
      isRecast: true,
    });

    if (originalContent) throw new CastcleException('RECAST_IS_EXIST');

    const author = new Author({
      id: user._id,
      avatar: user.profile?.images?.avatar || null,
      castcleId: user.displayId,
      displayName: user.displayName,
      type: user.type === UserType.PAGE ? UserType.PAGE : UserType.PEOPLE,
      verified: user.verified,
    });

    const sourceContentId =
      content.isRecast || content.isQuote
        ? content?.originalPost?._id
        : content._id;

    const newContent = {
      author: author,
      payload: {} as ShortPayload,
      revisionCount: 0,
      type: ContentType.Short,
      originalPost:
        content.isQuote || content.isRecast ? content?.originalPost : content,
      isRecast: true,
    } as Content;
    const recastContent = await this.repository.createContent(newContent);
    if (!recastContent) throw new CastcleException('CONTENT_NOT_FOUND');

    const engagement = await this.repository.createEngagement({
      type: EngagementType.Recast,
      user: user._id,
      account: user.ownerAccount,
      targetRef: {
        $ref: 'content',
        $id: sourceContentId,
      },
      itemId: recastContent._id,
      visibility: EntityVisibility.Publish,
    });

    const userOwner = await this.repository.findUser({
      _id: content.author.id,
    });

    if (userOwner && String(user._id) !== String(content.author.id))
      await this.notificationService.notifyToUser(
        {
          source:
            userOwner.type === UserType.PEOPLE
              ? NotificationSource.Profile
              : NotificationSource.Page,
          sourceUserId: user._id,
          type: NotificationType.Recast,
          contentRef: recastContent._id,
          account: userOwner.ownerAccount,
          read: false,
        },
        userOwner,
        account.preferences.languages[0],
      );

    return { recastContent, engagement };
  };

  undoRecast = async (contentId: string, user: User) => {
    const content = await this.repository.findContent({
      originalPost: contentId,
      author: user._id,
      isRecast: true,
    });

    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    if (content.hashtags) {
      await this.repository.removeFromTags(content.hashtags, {
        $inc: {
          score: -1,
        },
      });
    }

    await Promise.all([
      this.repository.updateUser(
        { _id: content.author.id },
        { $inc: { casts: -1 } },
      ),
      this.repository.deleteEngagements({
        user: content.author.id as any,
        targetRef: {
          $ref: 'content',
          $id: contentId,
        },
      }),
      this.repository.updateNotification(
        {
          type: NotificationType.Recast,
          contentRef: new Types.ObjectId(contentId),
          commentRef: { $exists: false },
          replyRef: { $exists: false },
        },
        {
          $pull: { sourceUserId: { $eq: user._id } },
        },
      ),
      content.remove(),
    ]);

    const notification = await this.repository.findNotification({
      type: NotificationType.Recast,
      contentRef: new Types.ObjectId(contentId),
      commentRef: { $exists: false },
      replyRef: { $exists: false },
    });

    if (notification && !notification?.sourceUserId?.length)
      await notification.remove();
  };

  quoteCast = async (
    contentId: string,
    message: string,
    user: User,
    account: Account,
  ) => {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const originalContent = await this.repository.findContent({
      originalPost: contentId,
      author: user._id,
      isQuote: true,
      message,
    });

    if (originalContent) throw new CastcleException('QUOTE_IS_EXIST');

    const author = new Author({
      id: user._id,
      avatar: user.profile?.images?.avatar || null,
      castcleId: user.displayId,
      displayName: user.displayName,
      type: user.type === UserType.PAGE ? UserType.PAGE : UserType.PEOPLE,
      verified: user.verified,
    });

    const sourceContentId =
      content.isRecast || content.isQuote
        ? content?.originalPost?._id
        : content._id;

    const newContent = {
      author: author,
      payload: {
        message: message,
      } as ShortPayload,
      revisionCount: 0,
      type: ContentType.Short,
      isQuote: true,
      originalPost:
        content.isQuote || content.isRecast ? content.originalPost : content,
    } as Content;

    const quoteContent = await this.repository.createContent(newContent);
    if (!quoteContent) throw new CastcleException('CONTENT_NOT_FOUND');

    const engagement = await this.repository.createEngagement({
      type: EngagementType.Quote,
      user: user._id,
      account: user.ownerAccount,
      targetRef: {
        $ref: 'content',
        $id: sourceContentId,
      },
      itemId: quoteContent._id,
      visibility: EntityVisibility.Publish,
    });

    const userOwner = await this.repository.findUser({
      _id: content.author.id,
    });

    if (userOwner && String(user._id) !== String(content.author.id))
      await this.notificationService.notifyToUser(
        {
          source:
            userOwner.type === UserType.PEOPLE
              ? NotificationSource.Profile
              : NotificationSource.Page,
          sourceUserId: user._id,
          type: NotificationType.Quote,
          contentRef: quoteContent._id,
          account: userOwner.ownerAccount,
          read: false,
        },
        userOwner,
        account.preferences.languages[0],
      );

    return { quoteContent, engagement };
  };

  createContentFarming = async (contentId: string, userId: string) => {
    const [balance] = await this.repository.aggregateTransaction(
      new Types.ObjectId(userId),
    );
    const farmAmount = Number(balance.total) * 0.05;
    if (Number(balance.total) >= farmAmount) {
      const session = await this.contentFarmingModel.startSession();
      const contentFarming = await new this.contentFarmingModel({
        content: new Types.ObjectId(contentId),
        user: new Types.ObjectId(userId),
        status: ContentFarmingStatus.Farming,
        farmAmount: new Types.Decimal128(farmAmount.toString()),
        startAt: new Date(),
      });

      const user = await this.repository.findUser({ _id: userId });

      await this.repository.createEngagement({
        type: EngagementType.Farm,
        user: user._id,
        account: user.ownerAccount,
        targetRef: {
          $ref: 'content',
          $id: new Types.ObjectId(contentId),
        },
        itemId: contentFarming._id,
        visibility: EntityVisibility.Publish,
      });

      session.startTransaction();
      try {
        await contentFarming.save();
        await this.tAccountService.transfer({
          from: {
            type: WalletType.PERSONAL,
            user: new Types.ObjectId(userId),
            value: new Types.Decimal128(farmAmount.toString()),
          },
          to: [
            {
              type: WalletType.FARM_LOCKED,
              user: new Types.ObjectId(userId),
              value: new Types.Decimal128(farmAmount.toString()),
            },
          ],
          type: TransactionType.FARMING,
          status: TransactionStatus.VERIFIED,
          ledgers: [
            {
              debit: {
                cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
                value: new Types.Decimal128(farmAmount.toString()),
              },
              credit: {
                cAccountNo: CAccountNo.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: new Types.Decimal128(farmAmount.toString()),
              },
            },
          ],
        });
        await session.commitTransaction();
        return contentFarming;
      } catch (error) {
        await session.abortTransaction();
        throw new CastcleException('INTERNAL_SERVER_ERROR');
      }
    } else {
      //throw error
      throw new CastcleException('CONTENT_FARMING_NOT_AVAILABLE_BALANCE');
    }
  };

  updateContentFarming = async (contentFarming: ContentFarming) => {
    contentFarming.status = ContentFarmingStatus.Farming;
    contentFarming.startAt = new Date();
    const [balance] = await this.repository.aggregateTransaction(
      new Types.ObjectId(contentFarming.user),
    );
    const farmAmount = Number(balance.total) * 0.05;
    if (Number(balance.total) >= farmAmount) {
      const session = await this.contentFarmingModel.startSession();
      contentFarming.farmAmount = new Types.Decimal128(farmAmount.toString());
      await session.withTransaction(async () => {
        await contentFarming.save();
        await this.tAccountService.transfer({
          from: {
            type: WalletType.PERSONAL,
            user: contentFarming.user,
            value: new Types.Decimal128(farmAmount.toString()),
          },
          to: [
            {
              type: WalletType.FARM_LOCKED,
              user: contentFarming.user,
              value: new Types.Decimal128(farmAmount.toString()),
            },
          ],
          type: TransactionType.FARMING,
          status: TransactionStatus.VERIFIED,
          ledgers: [
            {
              debit: {
                cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
                value: new Types.Decimal128(farmAmount.toString()),
              },
              credit: {
                cAccountNo: CAccountNo.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: new Types.Decimal128(farmAmount.toString()),
              },
            },
          ],
        });
      });
      await session.endSession();
      return contentFarming;
    } else {
      throw new CastcleException('CONTENT_FARMING_NOT_AVAILABLE_BALANCE');
    }
  };

  checkFarming = (contentFarming: ContentFarming) => {
    if (contentFarming && contentFarming.status === ContentFarmingStatus.Farmed)
      return false;
    else if (
      contentFarming &&
      contentFarming.status === ContentFarmingStatus.Farming
    )
      throw new CastcleException('CONTENT_FARMING_ALREADY_FARM');
    else if (!contentFarming) return false;
    else throw new CastcleException('CONTENT_FARMING_LIMIT');
  };

  getContentFarming = async (
    contentId: string,
    userId: string,
    projection: AnyKeys<ContentFarming> = {},
  ) =>
    this.contentFarmingModel.findOne(
      {
        content: new Types.ObjectId(contentId),
        user: new Types.ObjectId(userId),
      },
      projection,
      {
        sort: { createdAt: -1 },
      },
    );

  farm = async (contentId: string, userId: string, accountId: string) => {
    const [contentFarming, content, users, account, totalContentFarming] =
      await Promise.all([
        this.getContentFarming(contentId, userId),
        this.repository.findContent({ _id: contentId }),
        this.repository.findUsers({ accountId }),
        this.repository.findAccount({ _id: accountId }),
        this.contentFarmingModel.countDocuments({
          user: new Types.ObjectId(userId),
          status: ContentFarmingStatus.Farming,
        }),
      ]);

    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    if (totalContentFarming >= Environment.FARMING_LIMIT)
      throw new CastcleException('CONTENT_FARMING_LIMIT');

    if (users.some(({ id }) => id === String(content.author.id)))
      throw new CastcleException('CAN_NOT_FARMING_YOUR_CAST');

    const userOwner = await this.repository.findUser({
      _id: content.author.id,
    });
    await this.notificationService.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: new Types.ObjectId(userId),
        type: NotificationType.Farm,
        contentRef: content._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      account.preferences.languages[0],
    );

    if (this.checkFarming(contentFarming)) {
      return this.updateContentFarming(contentFarming);
    } else return this.createContentFarming(contentId, userId);
  };

  unfarmByFarmingId = async (farmingId: string, userId: string) => {
    const contentFarming = await this.contentFarmingModel.findOne(
      {
        _id: farmingId,
        status: ContentFarmingStatus.Farming,
      },
      {
        updatedAt: 0,
      },
    );
    try {
      if (!contentFarming)
        throw new CastcleException('CONTENT_FARMING_NOT_FOUND');

      if (String(contentFarming.user) !== userId)
        throw new CastcleException('FORBIDDEN');

      contentFarming.status = ContentFarmingStatus.Farmed;
      contentFarming.endedAt = new Date();
      const session = await this.contentFarmingModel.startSession();
      await session.withTransaction(async () => {
        await contentFarming.save();
        await this.contentModel.updateOne(
          { _id: contentFarming.content },
          {
            $push: {
              farming: contentFarming,
            },
          },
        );
        await this.tAccountService.transfer({
          from: {
            type: WalletType.FARM_LOCKED,
            user: contentFarming.user,
            value: contentFarming.farmAmount,
          },
          to: [
            {
              type: WalletType.PERSONAL,
              user: contentFarming.user,
              value: contentFarming.farmAmount,
            },
          ],
          type: TransactionType.UNFARMING,
          status: TransactionStatus.VERIFIED,
          ledgers: [
            {
              debit: {
                cAccountNo: CAccountNo.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: contentFarming.farmAmount,
              },
              credit: {
                cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
                value: contentFarming.farmAmount,
              },
            },
          ],
        });
      });
      await session.endSession();
      return contentFarming;
    } catch (e) {
      throw new CastcleException('CONTENT_FARMING_NOT_FOUND');
    }
  };

  /**
   * @deprecated The method should not be used.Please use unfarmByFarmingId()
   */
  unfarm = async (contentId: string, userId: string) => {
    const contentFarming = await this.getContentFarming(contentId, userId);
    if (
      contentFarming &&
      contentFarming.status === ContentFarmingStatus.Farming
    ) {
      contentFarming.status = ContentFarmingStatus.Farmed;
      contentFarming.endedAt = new Date();
      const session = await this.contentFarmingModel.startSession();
      await session.withTransaction(async () => {
        await contentFarming.save();
        await this.contentModel.updateOne(
          { _id: contentFarming.content },
          {
            $push: {
              farming: contentFarming,
            },
          },
        );
        await this.tAccountService.transfer({
          from: {
            type: WalletType.FARM_LOCKED,
            user: contentFarming.user,
            value: contentFarming.farmAmount,
          },
          to: [
            {
              type: WalletType.PERSONAL,
              user: contentFarming.user,
              value: contentFarming.farmAmount,
            },
          ],
          type: TransactionType.UNFARMING,
          status: TransactionStatus.VERIFIED,
          ledgers: [
            {
              debit: {
                cAccountNo: CAccountNo.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: contentFarming.farmAmount,
              },
              credit: {
                cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
                value: contentFarming.farmAmount,
              },
            },
          ],
        });
      });
      await session.endSession();
      return contentFarming;
    } else {
      throw new CastcleException('CONTENT_FARMING_NOT_FOUND');
    }
  };

  //for system only
  expireFarm = async (contentId: string, userId: string) => {
    //change status
    //move token from lock to personal
    const contentFarming = await this.getContentFarming(contentId, userId);
    const session = await this.contentFarmingModel.startSession();
    contentFarming.status = ContentFarmingStatus.Farmed;
    contentFarming.endedAt = new Date();
    try {
      session.startTransaction();
      await this.contentModel.updateOne(
        { _id: contentFarming.content },
        {
          $push: {
            farming: contentFarming,
          },
        },
      );
      await this.tAccountService.transfer({
        from: {
          type: WalletType.FARM_LOCKED,
          user: contentFarming.user,
          value: contentFarming.farmAmount,
        },
        to: [
          {
            type: WalletType.PERSONAL,
            user: contentFarming.user,
            value: contentFarming.farmAmount,
          },
        ],
        type: TransactionType.FARMED,
        status: TransactionStatus.VERIFIED,
        ledgers: [
          {
            debit: {
              cAccountNo: CAccountNo.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
              value: contentFarming.farmAmount,
            },
            credit: {
              cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
              value: contentFarming.farmAmount,
            },
          },
        ],
      });
      session.commitTransaction();
      return contentFarming.save();
    } catch (e) {
      session.abortTransaction();
      throw new CastcleException('INTERNAL_SERVER_ERROR');
    }
  };

  expireAllFarmedToken = async () => {
    const cutOffDate = new Date(
      new Date().getTime() -
        Environment.CONTENT_FARMING_COOLDOWN_HR * 60 * 1000,
    );
    const expiresFarmings = await this.contentFarmingModel.find({
      status: ContentFarmingStatus.Farming,
      startAt: { $lte: cutOffDate },
    });
    return Promise.all(
      expiresFarmings.map((cf) =>
        this.expireFarm(String(cf.content), String(cf.user)),
      ),
    );
  };

  getUndistributedContentFarmingCDF = async () => {
    const contents = await this.contentModel.find({
      farming: { $exists: true },
      'farming.isDistributed': { $ne: true },
    });
    return contents.map<ContentFarmingCDF>((content) => ({
      contentId: content.id,
      contentFarmings: content.farming,
    }));
  };

  findCumulativeStats = (contentFarmingCDF: ContentFarmingCDF) => {
    const now = new Date();
    contentFarmingCDF.contentFarmings = contentFarmingCDF.contentFarmings.map(
      (item) => {
        item.cdfStat.adjustedFarmPeriod =
          (now.getTime() - item.startAt.getTime()) / 86400000;
        item.cdfStat.expoWeight = cdf(item.cdfStat.adjustedFarmPeriod, Math.E);
        item.cdfStat.tokenWeight =
          item.cdfStat.expoWeight * Number(item.farmAmount);
        return item;
      },
    );
    return contentFarmingCDF;
  };

  findWeight = (contentFarmingCDF: ContentFarmingCDF) => {
    const totalExpo = contentFarmingCDF.contentFarmings.reduce(
      (p, now) => p + now.cdfStat.tokenWeight,
      0,
    );
    contentFarmingCDF.contentFarmings = contentFarmingCDF.contentFarmings.map(
      (item) => {
        item.weight = item.cdfStat.tokenWeight / totalExpo;
        return item;
      },
    );
    return contentFarmingCDF;
  };

  updateContentFarmingCDFStat = (contentFarmingCDF: ContentFarmingCDF) => {
    return Promise.all(
      contentFarmingCDF.contentFarmings.map((item) => {
        item.markModified('cdfStat');
        return item.save();
      }),
    );
  };

  updateAllUndistributedContentFarming = async () => {
    const contentFarmingCDFs = await this.getUndistributedContentFarmingCDF();
    return Promise.all(
      contentFarmingCDFs.map((item) => {
        item = this.findCumulativeStats(item);
        item = this.findWeight(item);
        return this.updateContentFarmingCDFStat(item);
      }),
    );
  };

  pipeContentFarming = async (
    contentFarming: ContentFarming,
    userId: string,
  ) => {
    const [[balance], [content], [participate]] = await Promise.all([
      this.repository.aggregateTransaction(new Types.ObjectId(userId)),
      this.repository.aggregationContentsV2({
        _id: contentFarming.content as any,
      }),
      this.repository.aggregationParticipate({
        targetRef: new DBRef(
          'content',
          new Types.ObjectId(contentFarming.content),
        ),
        userId: new Types.ObjectId(userId) as any,
      }),
    ]);

    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const contentPayload = contentFarming.content
      ? this.toContentPublishPayload(content, participate)
      : undefined;

    const user = await this.repository.findUser({
      _id: content.authorId,
    });

    const relationships = await this.repository.findRelationships({
      userId: userId as any,
      followedUser: [user._id],
    });

    const relationship = relationships?.find(
      (relationship) =>
        String(relationship.followedUser) === String(content.authorId),
    );

    const totalContentFarming = await this.contentFarmingModel.countDocuments({
      _id: { $lte: contentFarming._id },
      user: new Types.ObjectId(userId),
      status: ContentFarmingStatus.Farming,
    });

    const includesUsers = new Author({
      id: user.id,
      avatar: user.profile?.images?.avatar,
      castcleId: user.displayId,
      displayName: user.displayName,
      type: user.type,
      verified: user.verified,
    }).toIncludeUser({
      blocked: relationship?.blocking ?? false,
      followed: relationship?.following ?? false,
    });

    return {
      ...new ContentFarmingResponse(
        contentFarming,
        Number(balance?.total).toFixed(Environment.DECIMALS_FLOAT),
        Number(balance?.farm).toFixed(Environment.DECIMALS_FLOAT),
        Number(balance?.available).toFixed(Environment.DECIMALS_FLOAT),
        contentFarming.status === ContentFarmingStatus.Farmed
          ? totalContentFarming + 1
          : totalContentFarming,
        contentPayload,
      ),
      includes: new CastcleIncludes({
        users: [includesUsers],
      }),
    };
  };

  getEngagementCast = async (
    contentId: string,
    account: Account,
    query: PaginationQuery,
    type?: EngagementType,
    viewer?: User,
  ) => {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const filter = {
      targetRef: {
        $ref: 'content',
        $id: new Types.ObjectId(contentId),
      },
      type,
    };

    const engagementDocuments = await this.repository.findEngagements(
      { ...query, ...filter },
      {
        limit: query.maxResults,
        sort: { createdAt: -1 },
        populate: 'user',
      },
    );

    const usersEngagement = engagementDocuments.filter((item) => item.user);

    if (!usersEngagement.length)
      return ResponseDto.ok({
        payload: [],
        meta: { resultCount: 0 },
      });

    if (!query.hasRelationshipExpansion || account.isGuest) {
      const userResponses = await Promise.all(
        usersEngagement.map(async ({ user }) => user.toPublicResponse()),
      );
      return ResponseDto.ok({
        payload: userResponses,
        meta: Meta.fromDocuments(engagementDocuments as any[]),
      });
    }

    const usersId = usersEngagement.map(({ user }) => user._id);

    const relationships = await this.repository
      .findRelationships({
        userId: viewer._id,
        followedUser: usersId,
      })
      .exec();

    const relationship = relationships?.find(
      (relationship) => String(relationship.user) === String(viewer?._id),
    );

    const userResponses = usersEngagement.map(({ user }) =>
      user.toPublicResponse({
        blocked: relationship?.blocking ?? false,
        followed: relationship?.following ?? false,
      }),
    );

    return ResponseDto.ok({
      payload: userResponses,
      meta: Meta.fromDocuments(usersEngagement as any[]),
    });
  };

  getQuoteByCast = async (
    contentId: string,
    query: PaginationQuery,
    viewer?: User,
  ) => {
    this.logger.log('Start get quote cast');
    const contents = await this.repository.aggregationContentsV2({
      viewer: viewer,
      originalPost: contentId,
      maxResults: query.maxResults,
      sinceId: query.sinceId,
      untilId: query.untilId,
      isQuote: true,
    });

    const { payloadContents, includeUsers, includeCasts } =
      await this.convertContentToResponses(
        contents,
        viewer.id,
        query.userFields,
        true,
      );

    return ResponseDto.ok({
      payload: payloadContents,
      includes: new CastcleIncludes({
        users: includeUsers,
        casts: includeCasts,
      }),
    });
  };

  getUserContents = async (
    query: PaginationQuery,
    targetUser: User,
    requestedBy?: User,
  ) => {
    const contents = await this.repository.aggregationContentsV2({
      ...query,
      author: targetUser._id,
      viewer: requestedBy,
      visibility:
        String(targetUser.ownerAccount) === String(requestedBy?.ownerAccount)
          ? [EntityVisibility.Publish, EntityVisibility.Illegal]
          : undefined,
    });

    const { payloadContents, includeUsers, includeCasts } =
      await this.convertContentToResponses(
        contents,
        requestedBy?.id,
        query.userFields,
        String(targetUser.ownerAccount) === String(requestedBy?.ownerAccount),
      );

    return ResponseDto.ok({
      payload: payloadContents,
      includes: new CastcleIncludes({
        users: includeUsers,
        casts: includeCasts,
      }),
      meta: Meta.fromDocuments(payloadContents),
    });
  };

  getContent = async (
    contentId: string,
    requestedBy?: User,
    userFields?: UserField[],
  ) => {
    const contents = await this.repository.aggregationContentsV2({
      viewer: requestedBy,
      _id: contentId,
      visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
    });

    if (
      contents?.some(
        (content) =>
          requestedBy?.id !== String(content.authorId) &&
          content.visibility === EntityVisibility.Illegal,
      )
    )
      throw new CastcleException('CONTENT_NOT_FOUND');

    const { payloadContents, includeUsers, includeCasts } =
      await this.convertContentToResponses(
        contents,
        requestedBy.id,
        userFields,
        true,
      );

    return ResponseDto.ok({
      payload: payloadContents[0],
      includes: new CastcleIncludes({
        users: includeUsers,
        casts: includeCasts,
      }),
    });
  };

  createContent = async (body: CreateContentDto, requestedBy: User) => {
    const author = await this.repository.findUser({
      _id: body.castcleId,
    });
    if (!author) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    if (String(author.ownerAccount) !== String(requestedBy.ownerAccount))
      throw new CastcleException('FORBIDDEN');

    const convertImage = await this.repository.createContentImage(
      body,
      author._id,
    );

    const hashtags = this.hashtagService.extractHashtagFromContentPayload(
      body.payload,
    );

    const newContent = {
      author: new Author({
        id: author._id,
        avatar: author.profile?.images?.avatar || null,
        castcleId: author.displayId,
        displayName: author.displayName,
        type: author.type === UserType.PAGE ? UserType.PAGE : UserType.PEOPLE,
        verified: author.verified,
      }),
      payload: convertImage.payload,
      revisionCount: 0,
      type: body.type,
      visibility: EntityVisibility.Publish,
      hashtags: hashtags,
    };
    const content = await this.repository.createContent(newContent);

    await this.contentQueue.add(
      {
        event: ContentMessageEvent.NEW_CONTENT,
        contentId: content.id,
      },
      {
        removeOnComplete: true,
      },
    );

    const contents = await this.repository.aggregationContentsV2({
      _id: content._id,
    });

    const { payloadContents, includeUsers } =
      await this.convertContentToResponses(contents, requestedBy.id, [], true);

    return ResponseDto.ok({
      payload: payloadContents[0],
      includes: new CastcleIncludes({
        users: includeUsers,
      }),
    });
  };

  deleteContent = async (contentId: string, user: User) => {
    const users = await this.repository.findUsers({
      accountId: user.ownerAccount as any,
    });

    if (!users) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const content = await this.repository.findContent({
      _id: contentId,
      author: users.map(({ _id }) => _id),
    });

    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    if (!users.some((user) => user.id === String(content.author.id)))
      throw new CastcleException('FORBIDDEN');

    const contents = await this.repository.findContents({
      originalPost: contentId,
    });

    const usersAction = await this.repository.findUsers({
      _id: contents.map(({ author }) => author.id),
    });

    await Promise.all([
      usersAction.map(async (user) =>
        this.repository.updateUser(
          {
            _id: user._id,
          },
          {
            $inc: {
              casts: -contents.filter(
                (content) => String(content.author.id) === user.id,
              ).length,
            },
          },
        ),
      ),
      this.repository.deleteAllContent(content._id),
      this.repository.updateUser(
        { _id: content.author.id },
        { $inc: { casts: -1 } },
      ),
      this.repository.pauseAdsFromContentId(content._id),
    ]);
  };

  getParticipates = async (contentId: string, account: Account) => {
    const users = await this.repository
      .findUsers({ accountId: account._id })
      .exec();

    if (!users.length) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const userIds = users.map((user) => user._id);

    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const engagements = await this.repository.findEngagements({
      user: userIds,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
    });

    const userParticipates = users.map((user) => {
      const isUserFarming = this.isUserFarmingContent(content, [user._id]);

      return {
        user: {
          id: user.id,
          castcleId: user.displayId,
          displayName: user.displayName,
          type: user.type,
        },
        participate: toUnsignedContentPayloadItem(
          content,
          engagements.filter((item) => String(item.user) === String(user._id)),
          undefined,
          isUserFarming,
        ).participate,
      };
    });

    return userParticipates as ResponseParticipate[];
  };

  getSearchRecent = async (query: GetSearchQuery, viewer?: User) => {
    const blocking = await this.userServiceV2.getUserRelationships(
      viewer,
      true,
    );

    let contents = await this.repository.aggregationContentsV2({
      viewer,
      excludeAuthor: blocking,
      ...query,
    });

    if (contents.length && contents.length < query.maxResults) {
      const contentsMore = await this.repository.aggregationContentsV2({
        viewer,
        maxResults: query.maxResults - contents.length,
        excludeContents: contents.map(
          (content) => new Types.ObjectId(content._id),
        ) as any,
        excludeAuthor: blocking,
        contentType: query.contentType,
      });

      contents = [...contents, ...contentsMore];
    }

    const { payloadContents, includeUsers, includeCasts } =
      await this.convertContentToResponses(
        contents,
        viewer.id,
        query.userFields,
        true,
      );

    return ResponseDto.ok({
      payload: payloadContents,
      includes: new CastcleIncludes({
        users: includeUsers,
        casts: includeCasts,
      }),
      meta: Meta.fromDocuments(payloadContents),
    });
  };

  getSearchTrends = async (
    { userFields, maxResults, sinceId, untilId, ...query }: GetSearchQuery,
    viewer: User,
    account: Account,
  ) => {
    const blocking = await this.userServiceV2.getUserRelationships(
      viewer,
      true,
    );

    const contentKey = CacheStore.ofTrendsSearch(
      `${query.keyword.input}${
        query.contentType ? `-${query.contentType}` : ''
      }`,
    );
    const scoreKey = CacheStore.ofTrendsSearch(
      `${query.keyword.input}${
        query.contentType ? `-${query.contentType}` : ''
      }`,
      account.id,
    );

    let contentScore = (await this.cacheManager.get(scoreKey))
      ? JSON.parse(await this.cacheManager.get(scoreKey))
      : undefined;

    let contentsId = (await this.cacheManager.get(contentKey))
      ? JSON.parse(await this.cacheManager.get(contentKey))
      : undefined;

    if (!contentsId) {
      contentsId = await this.repository.findContents(
        {
          ...query,
          maxResults: Environment.LIMIT_CONTENT,
          decayDays: Environment.DECAY_DAY_CONTENT,
          excludeAuthor: blocking,
        },
        {
          projection: { _id: 1 },
          sort: {
            createdAt: -1,
          },
        },
      );

      await this.cacheManager.set(contentKey, JSON.stringify(contentsId), {
        ttl: Environment.TOP_TREND_TTL,
      });
    }

    if (!contentScore && !account.isGuest) {
      contentScore = await this.sortContentsByScore(account._id, contentsId);
      await this.cacheManager.set(scoreKey, JSON.stringify(contentScore), {
        ttl: Environment.TOP_TREND_TTL,
      });
    }

    if (!contentsId.length)
      return ResponseDto.ok({
        payload: [],
        includes: { casts: [], users: [] },
        meta: { resultCount: 0 },
      });

    contentsId =
      contentScore && !account.isGuest
        ? contentsId.sort(
            (a, b) => contentScore[String(b._id)] - contentScore[String(a._id)],
          )
        : contentsId;

    if (!(sinceId || untilId)) {
      contentsId.length =
        contentsId.length > maxResults ? maxResults : contentsId.length;
    } else {
      if (sinceId) {
        const index = contentsId.findIndex(
          (content) => String(content._id) === String(sinceId),
        );

        if (index > -1) {
          contentsId = contentsId.slice(maxResults - 1 - index, index + 1);
        }
      }

      if (untilId) {
        const index = contentsId.findIndex(
          (content) => String(content._id) === String(untilId),
        );
        if (index > -1) {
          contentsId = contentsId.slice(index + 1, index + 1 + maxResults);
        }
      }
    }

    let contents = await this.repository.aggregationContentsV2({
      viewer,
      maxResults: maxResults,
      _id: contentsId.map((content) => content._id),
      excludeAuthor: blocking,
      contentType: query.contentType,
      ...query,
    });

    if (!account.isGuest)
      contents = contents.sort(
        (a, b) => contentScore[String(b._id)] - contentScore[String(a._id)],
      );

    if (contents.length && contents.length < maxResults) {
      let contentsMore = await this.repository.aggregationContentsV2({
        viewer,
        maxResults: maxResults - contents.length,
        excludeContents: contents.map(
          (content) => new Types.ObjectId(content._id),
        ) as any,
        decayDays: Environment.DECAY_DAY_CONTENT,
        excludeAuthor: blocking,
      });

      if (!account.isGuest) {
        const score = await this.sortContentsByScore(account._id, contentsMore);

        contentsMore = contentsMore.sort(
          (a, b) => score[String(b._id)] - score[String(a._id)],
        );
      }

      contents = [...contents, ...contentsMore];
    }

    const { payloadContents, includeUsers, includeCasts } =
      await this.convertContentToResponses(
        contents,
        viewer.id,
        userFields,
        false,
      );
    return ResponseDto.ok({
      payload: payloadContents,
      includes: new CastcleIncludes({
        users: includeUsers,
        casts: includeCasts,
      }),
      meta: Meta.fromDocuments(payloadContents),
    });
  };

  private isUserFarmingContent(content: Content, usersId: any[]) {
    const userIds = usersId.map((user) => String(user._id));
    return (
      content.farming?.some((farming) =>
        userIds.includes(String(farming.user)),
      ) || false
    );
  }

  private async findAllUsersIdFromAccount(requestedBy: User) {
    const usersInAccount = await this.repository.findUsers({
      accountId: requestedBy.ownerAccount as any,
    });

    return usersInAccount;
  }

  offViewFeedItem(accountId: string, feedItemId: string) {
    return this.repository
      .updateFeedItem(
        {
          viewer: accountId as any,
          _id: feedItemId,
          offViewAt: {
            $exists: false,
          },
        },
        {
          offViewAt: new Date(),
        },
      )
      .exec();
  }

  async reportContent(requestedBy: User, body: ReportContentDto) {
    const targetContent = await this.repository.findContent({
      _id: body.targetContentId,
    });

    if (!targetContent) throw new CastcleException('CONTENT_NOT_FOUND');

    if (String(targetContent.author.id) === String(requestedBy.id))
      throw new CastcleException('FORBIDDEN');

    const reportingExists = await this.repository.findReporting({
      payloadId: targetContent._id,
      subject: body.subject,
      by: requestedBy._id,
    });

    if (reportingExists) throw new CastcleException('REPORTING_IS_EXIST');

    const engagementFilter = {
      user: requestedBy._id,
      targetRef: { $ref: 'content', $id: targetContent._id },
      type: EngagementType.Report,
    };

    const [content] = await this.repository.aggregationContentsV2({
      _id: targetContent._id,
    });

    const [participate] = await this.repository.aggregationParticipate({
      targetRef: new DBRef('content', new Types.ObjectId(targetContent._id)),
      userId: requestedBy._id,
    });

    const payload = this.toContentPublishPayload(content, participate);

    const reportingSubject = await this.repository.findReportingSubject({
      type: MetadataType.REPORTING_SUBJECT,
      subject: body.subject,
    });

    if (!reportingSubject)
      throw new CastcleException('REPORTING_SUBJECT_NOT_FOUND');

    const user = await this.repository.findUser({
      _id: targetContent.author.id,
    });

    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    if (requestedBy._id && requestedBy.ownerAccount)
      await this.repository.updateEngagement(
        engagementFilter,
        {
          user: requestedBy._id,
          type: EngagementType.Report,
          targetRef: new DBRef('content', new Types.ObjectId(targetContent.id)),
          visibility: EntityVisibility.Publish,
          account: requestedBy.ownerAccount,
        },
        { upsert: true },
      );

    await Promise.all([
      this.repository.createReporting({
        by: requestedBy._id,
        message: body.message,
        payload: targetContent,
        subject: body.subject,
        type: ReportingType.CONTENT,
        user: targetContent.author.id,
      }),
      this.reportingQueue.add(
        {
          subject: `${ReportingAction.REPORT} content : (OID : ${targetContent._id})`,
          content: this.mailerService.generateHTMLReport(
            { ...payload, author: targetContent.author },
            {
              action: ReportingAction.REPORT,
              message: body.message,
              reportedBy: requestedBy.displayName,
              subject: reportingSubject.payload.name,
              type: ReportingType.CONTENT,
              user: {
                id: targetContent.author.id,
                castcleId: targetContent.author.castcleId,
                displayName: targetContent.author.displayName,
              },
            },
          ),
        },
        {
          removeOnComplete: true,
        },
      ),
    ]);
  }

  updateAppealContent = async (
    contentId: string,
    requestedBy: User,
    status: ReportingStatus,
  ) => {
    const content = await this.repository.findContent({
      _id: contentId,
      visibility: EntityVisibility.Illegal,
    });

    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    if (!content?.reportedStatus)
      throw new CastcleException('REPORTING_STATUS_NOT_FOUND');

    if (content?.reportedStatus !== ReportingStatus.ILLEGAL)
      throw new CastcleException('REPORTING_APPEAL_IS_EXISTS');

    const userOwners = await this.repository.findUsers({
      _id: content.author.id,
    });

    if (
      userOwners.every(
        (user) =>
          String(user.ownerAccount) !== String(requestedBy.ownerAccount),
      )
    )
      throw new CastcleException('FORBIDDEN');

    const reporting = await this.repository.findReporting({
      user: content.author.id as any,
      payloadId: content._id,
    });

    if (!reporting) return;

    await this.repository.updateReportings(
      {
        user: content.author.id as any,
        payloadId: content._id,
      },
      {
        $set: { status },
      },
    );

    content.reportedStatus = status;
    await content.save();

    if (status === ReportingStatus.NOT_APPEAL) return;

    const [newContent] = await this.repository.aggregationContentsV2({
      _id: content._id,
      visibility: [EntityVisibility.Illegal, EntityVisibility.Publish],
    });
    const [participate] = await this.repository.aggregationParticipate({
      targetRef: new DBRef('content', new Types.ObjectId(content._id)),
      userId: requestedBy._id,
    });

    const payload = this.toContentPublishPayload(newContent, participate);

    const reportingSubject = await this.repository.findReportingSubject({
      type: MetadataType.REPORTING_SUBJECT,
      subject: reporting.subject,
    });

    await this.reportingQueue.add(
      {
        subject: `${ReportingAction.APPEAL} content : (OID : ${content._id})`,
        content: this.mailerService.generateHTMLReport(
          { ...payload, author: content.author },
          {
            action: ReportingAction.APPEAL,
            actionBy: reporting.actionBy,
            message: reporting.message,
            reportedBy: requestedBy.displayName,
            subject: reportingSubject.payload.name,
            type: ReportingType.CONTENT,
            user: {
              id: content.author.id,
              castcleId: content.author.castcleId,
              displayName: content.author.displayName,
            },
          },
        ),
      },
      {
        removeOnComplete: true,
      },
    );
  };

  lookupFarming = async (contentId: string, user: User) => {
    const contentFarming = await this.getContentFarming(contentId, user._id, {
      updatedAt: 0,
      endedAt: 0,
    });

    const [balance] = await this.repository.aggregateTransaction(user._id);
    if (
      contentFarming &&
      contentFarming?.status !== ContentFarmingStatus.Farming
    ) {
      contentFarming._id = null;
      contentFarming.createdAt = null;
    }

    const [[content], [participate]] = await Promise.all([
      this.repository.aggregationContentsV2({
        _id: contentId,
      }),
      this.repository.aggregationParticipate({
        targetRef: new DBRef('content', new Types.ObjectId(contentId)),
        userId: user._id,
      }),
    ]);

    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const author = await this.repository.findUser({ _id: content.authorId });

    if (!author) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    if (String(author.ownerAccount) === String(user.ownerAccount))
      throw new CastcleException('CAN_NOT_FARMING_YOUR_CAST');

    const relationships = await this.repository.findRelationships({
      userId: user._id,
      followedUser: [author._id],
    });

    const relationship = relationships?.find(
      (relationship) => String(relationship.followedUser) === String(author.id),
    );

    const [lastActive] = await this.contentFarmingModel.find(
      {
        user: user._id,
        status: ContentFarmingStatus.Farming,
      },
      {},
      { sort: { _id: -1 }, limit: 1 },
    );

    const [totalContentFarming, activeContentFarming] = await Promise.all([
      this.contentFarmingModel.countDocuments({
        _id: { $lte: lastActive?._id },
        user: user._id,
        status: ContentFarmingStatus.Farming,
      }),
      this.contentFarmingModel.countDocuments({
        _id: { $lte: contentFarming?._id },
        user: user._id,
        status: ContentFarmingStatus.Farming,
      }),
    ]);

    const includesUsers = new Author({
      id: author.id,
      avatar: author.profile?.images?.avatar,
      castcleId: author.displayId,
      displayName: author.displayName,
      type: author.type,
      verified: author.verified,
    }).toIncludeUser({
      blocked: relationship?.blocking ?? false,
      followed: relationship?.following ?? false,
    });

    return {
      ...new ContentFarmingResponse(
        contentFarming,
        Number(balance?.total).toFixed(Environment.DECIMALS_FLOAT),
        Number(balance?.farm).toFixed(Environment.DECIMALS_FLOAT),
        Number(balance?.available).toFixed(Environment.DECIMALS_FLOAT),
        contentFarming?.status === ContentFarmingStatus.Farming
          ? activeContentFarming
          : totalContentFarming + 1,
        content
          ? this.toContentPublishPayload(content, participate)
          : undefined,
      ),
      includes: new CastcleIncludes({
        users: [includesUsers],
      }),
    };
  };

  farmingActive = async (viewer: User) => {
    const contentFarmings = await this.contentFarmingModel.find(
      {
        user: new Types.ObjectId(viewer.id),
        status: ContentFarmingStatus.Farming,
      },
      {},
      { sort: { createdAt: -1 } },
    );
    const [[balance], totalContentFarming] = await Promise.all([
      this.repository.aggregateTransaction(viewer._id),
      this.contentFarmingModel.countDocuments({
        user: new Types.ObjectId(viewer.id),
        status: ContentFarmingStatus.Farming,
      }),
    ]);

    const [contents, participates] = await Promise.all([
      this.repository.aggregationContentsV2({
        _id: contentFarmings.map(({ content }) => content as unknown as string),
      }),
      this.repository.aggregationParticipates({
        targetRef: contentFarmings.map(
          ({ content }) => new DBRef('content', new Types.ObjectId(content)),
        ),
        userId: viewer._id,
      }),
    ]);

    const users = await this.repository.findUsers({
      _id: contents.map(({ authorId }) => authorId),
    });

    const relationships = await this.repository.findRelationships({
      userId: viewer._id,
      followedUser: contents.map(({ authorId }) => authorId),
    });
    const [farmsAmount] = await Promise.all([
      this.repository.aggregationGetFarmAmount({
        content: [
          ...contents.map((content) => new Types.ObjectId(content._id)),
          ...contents.map(
            ({ originalPost }) => new Types.ObjectId(originalPost?._id),
          ),
        ],
        status: ContentFarmingStatus.Farming,
      }),
    ]);

    const farmingPayload = await Promise.all(
      contentFarmings.map(async (contentFarming, index) => {
        const content = contents.find(
          (content) => String(content._id) === String(contentFarming.content),
        );

        const participate = participates.find(
          ({ _id }) => String(_id) === String(contentFarming.content),
        );

        const farmAmount = Number(
          farmsAmount.find(
            (farm) => String(farm.contentId) === String(content._id),
          )?.farmAmount,
        );

        return new ContentFarmingResponse(
          contentFarming,
          Number(balance?.total).toFixed(Environment.DECIMALS_FLOAT),
          Number(balance?.farm).toFixed(Environment.DECIMALS_FLOAT),
          Number(balance?.available).toFixed(Environment.DECIMALS_FLOAT),
          totalContentFarming - index,
          content
            ? this.toContentPublishPayload(content, participate, farmAmount)
            : undefined,
          Number(farmAmount).toFixed(Environment.DECIMALS_FLOAT),
        );
      }),
    );

    const includesUsers = users.map((user) => {
      const relationship = relationships?.find(
        (relationship) => String(relationship.followedUser) === String(user.id),
      );

      return new Author({
        id: user.id,
        avatar: user.profile?.images?.avatar,
        castcleId: user.displayId,
        displayName: user.displayName,
        type: user.type,
        verified: user.verified,
      }).toIncludeUser({
        blocked: relationship?.blocking ?? false,
        followed: relationship?.following ?? false,
      });
    });

    return ResponseDto.ok({
      payload: farmingPayload,
      includes: new CastcleIncludes({
        users: includesUsers,
      }),
    });
  };

  farmingHistory = async (
    { maxResults, untilId }: PaginationQuery,
    viewer: User,
  ) => {
    const contentFarmings = await this.contentFarmingModel.find(
      createCastcleFilter(
        {
          user: new Types.ObjectId(viewer.id),
          status: ContentFarmingStatus.Farmed,
        },
        { untilId },
      ),
      {},
      {
        limit: maxResults,
        sort: { createdAt: -1 },
      },
    );

    const [balance] = await this.repository.aggregateTransaction(viewer._id);

    // const [{ contents, engagements }] =
    //   await this.repository.aggregationContent({
    //     _id: contentFarmings.map(({ content }) => content as unknown as string),
    //     viewer,
    //   });

    const [contents, participates] = await Promise.all([
      this.repository.aggregationContentsV2({
        _id: contentFarmings.map(({ content }) => content as unknown as string),
      }),
      this.repository.aggregationParticipates({
        targetRef: contentFarmings.map(
          ({ content }) => new DBRef('content', new Types.ObjectId(content)),
        ),
        userId: viewer._id,
      }),
    ]);

    const users = await this.repository.findUsers({
      _id: contents.map(({ authorId }) => authorId),
    });

    const relationships = await this.repository.findRelationships({
      userId: viewer._id,
      followedUser: contents.map(({ authorId }) => authorId),
    });

    const farmsAmount = await this.repository.aggregationGetFarmAmount({
      content: contents.map((content) => new Types.ObjectId(content._id)),
      status: ContentFarmingStatus.Farming,
    });

    const farmingPayload = await Promise.all(
      contentFarmings.map(async (contentFarming) => {
        const content = contents.find(
          (content) => String(content._id) === String(contentFarming.content),
        );

        const participate = participates.find(
          ({ _id }) => String(_id) === String(contentFarming.content),
        );

        const farmAmount = Number(
          farmsAmount.find(
            (farm) => String(farm.contentId) === String(content._id),
          )?.farmAmount,
        );

        return new ContentFarmingResponse(
          contentFarming,
          Number(balance?.total).toFixed(Environment.DECIMALS_FLOAT),
          Number(balance?.farm).toFixed(Environment.DECIMALS_FLOAT),
          Number(balance?.available).toFixed(Environment.DECIMALS_FLOAT),
          undefined,
          content
            ? this.toContentPublishPayload(content, participate)
            : undefined,
          Number(farmAmount).toFixed(Environment.DECIMALS_FLOAT),
        );
      }),
    );
    const includesUsers = users.map((user) => {
      const relationship = relationships?.find(
        (relationship) => String(relationship.followedUser) === String(user.id),
      );

      return new Author({
        id: user.id,
        avatar: user.profile?.images?.avatar,
        castcleId: user.displayId,
        displayName: user.displayName,
        type: user.type,
        verified: user.verified,
      }).toIncludeUser({
        blocked: relationship?.blocking ?? false,
        followed: relationship?.following ?? false,
      });
    });

    return ResponseDto.ok({
      payload: farmingPayload,
      includes: new CastcleIncludes({
        users: includesUsers,
      }),
      meta: Meta.fromDocuments(farmingPayload),
    });
  };

  async contentFlowIllegal(contentId: string, dsIllegal: ContentFlowItem) {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    if (!dsIllegal.illegalClass) return;

    content.visibility = EntityVisibility.Illegal;

    await this.reportContent(
      {
        _id: null,
        ownerAccount: null,
        displayName: 'ds guardian',
      } as User,
      {
        targetContentId: content.id,
        subject: dsIllegal.illegalSubject,
      },
    );

    const reportings = await this.repository.findReportings({
      payloadId: content._id,
      type: ReportingType.CONTENT,
      status: [
        ReportingStatus.REVIEWING,
        ReportingStatus.ILLEGAL,
        ReportingStatus.APPEAL,
        ReportingStatus.NOT_APPEAL,
        ReportingStatus.DONE,
      ],
    });

    if (!reportings.length) throw new CastcleException('REPORTING_NOT_FOUND');

    const user = await this.repository.findUser({
      _id: content.author.id,
      visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
    });

    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const account = await this.repository.findAccount({
      _id: user.ownerAccount,
    });

    if (!account) throw new CastcleException('REQUEST_URL_NOT_FOUND');

    user.casts--;

    content.reportedStatus = ReportingStatus.ILLEGAL;
    content.reportedSubject = dsIllegal.illegalSubject;

    await this.repository.updateCastByReCastORQuote(
      content._id,
      EntityVisibility.Illegal,
      -1,
    );

    await this.notificationService.notifyToUser(
      {
        source:
          user.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: undefined,
        type: NotificationType.IllegalDone,
        contentRef: content._id,
        account: account._id,
        read: false,
      },
      user,
      account?.preferences?.languages[0] ?? LocalizationLang.English,
    );

    await Promise.all([
      content.save(),
      user.save(),
      this.repository.updateReportings(
        {
          payloadId: content._id,
          type: ReportingType.CONTENT,
          status: [ReportingStatus.REVIEWING],
        },
        {
          $set: {
            status: ReportingStatus.DONE,
          },
          $addToSet: {
            actionBy: {
              firstName: 'ds',
              lastName: 'guardian',
              email: null,
              action: ReportingIllegal.ILLEGAL,
              status: ReportingStatus.DONE,
              message: dsIllegal.illegalMessage,
              subject: dsIllegal.illegalSubject,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        },
      ),
    ]);
  }

  findContent = async (contentId: string) => {
    return this.repository.findContent({
      _id: contentId,
    });
  };
}
