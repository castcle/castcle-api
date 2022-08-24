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
  FeedItemPayloadItem,
  FeedItemResponse,
  FeedQuery,
  GetCastDto,
  GetSearchQuery,
  Meta,
  Metrics,
  NotificationSource,
  NotificationType,
  PaginationQuery,
  ReportContentDto,
  ResponseDto,
  ResponseParticipate,
  ShortPayload,
} from '../dtos';
import {
  CAccountNo,
  ContentFarmingStatus,
  ContentFlowItem,
  ContentMessage,
  ContentMessageEvent,
  ContentType,
  EngagementType,
  MetadataType,
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
  Engagement,
  FeedItem,
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
  toCastPayload = (dto: {
    content: Content;
    metrics?: Metrics;
    engagements?: Engagement[];
    reportedStatus?: ReportingStatus;
    reportedSubject?: string;
    farming?: { isUserFarming: boolean; farmingContent: ContentFarming[] };
  }) => {
    return {
      id: dto.content.id ?? dto.content._id,
      authorId: dto.content.author.id,
      type: dto.content.type,
      message: (dto.content.payload as ShortPayload)?.message,
      link: (dto.content.payload as ShortPayload)?.link
        ? (dto.content.payload as ShortPayload)?.link.map((link) => {
            if (!link?.image) return link;
            return CastcleImage.sign(link.image as CastcleImage);
          })
        : undefined,
      photo: {
        contents: (dto.content.payload as ShortPayload)?.photo?.contents
          ? (dto.content.payload as ShortPayload)?.photo?.contents.map(
              (image) => CastcleImage.sign(image),
            )
          : [],
      },
      metrics: dto.metrics ?? {
        likeCount: dto.content.engagements?.like?.count | 0,
        commentCount: dto.content.engagements?.comment?.count | 0,
        quoteCount: dto.content.engagements?.quote?.count | 0,
        recastCount: dto.content.engagements?.recast?.count | 0,
        farmCount:
          dto.farming?.farmingContent?.reduce(
            (farmCountTotal, { farmAmount }) =>
              (farmCountTotal += Number(farmAmount)),
            0,
          ) | 0,
      },
      participate: {
        liked:
          dto.engagements?.some(
            ({ targetRef, type }) =>
              String(targetRef.oid) === String(dto.content._id) &&
              type === EngagementType.Like,
          ) ?? false,
        commented:
          dto.engagements?.some(
            ({ targetRef, type }) =>
              String(targetRef.oid) === String(dto.content._id) &&
              type === EngagementType.Comment,
          ) ?? false,
        quoted:
          dto.engagements?.some(
            ({ targetRef, type }) =>
              String(targetRef.oid) === String(dto.content._id) &&
              type === EngagementType.Quote,
          ) ?? false,
        recasted:
          dto.engagements?.some(
            ({ targetRef, type }) =>
              String(targetRef.oid) === String(dto.content._id) &&
              type === EngagementType.Recast,
          ) ?? false,
        reported:
          dto.engagements?.some(
            ({ targetRef, type }) =>
              String(targetRef.oid) === String(dto.content._id) &&
              type === EngagementType.Report,
          ) ?? false,
        farmed: dto.farming?.isUserFarming,
      },
      referencedCasts:
        dto.content.isRecast || dto.content.isQuote
          ? {
              type: dto.content.isRecast
                ? ReferencedTypeCast.Recasted
                : ReferencedTypeCast.Quoted,
              id: dto.content.originalPost._id,
            }
          : undefined,
      reportedStatus: dto.reportedStatus,
      reportedSubject: dto.reportedSubject,
      createdAt: dto.content.createdAt.toISOString(),
      updatedAt: dto.content.updatedAt.toISOString(),
    };
  };

  private toContentsResponses = async (
    {
      contents,
      casts,
      authors,
      engagements,
      metrics,
      engagementsOriginal,
      metricsOriginal,
    }: GetCastDto,
    hasRelationshipExpansion?: boolean,
    requestedBy?: User,
  ) => {
    const users = requestedBy
      ? await this.repository.findUsers({
          _id: contents.map(({ author }) => author.id),
          visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
        })
      : [];

    const usersId = requestedBy
      ? await this.findAllUsersIdFromAccount(requestedBy)
      : [];

    const payloadContents = contents.map((content) => {
      const isUserFarming = this.isUserFarmingContent(content, usersId);
      return this.toCastPayload({
        content,
        engagements,
        metrics: metrics?.find((metric) => String(metric._id) === content.id),
        farming: { isUserFarming, farmingContent: content.farming },
        reportedStatus: users.some(
          (user) =>
            String(requestedBy?.ownerAccount) === String(user.ownerAccount),
        )
          ? content.reportedStatus
          : undefined,
        reportedSubject: users.some(
          (user) =>
            String(requestedBy?.ownerAccount) === String(user.ownerAccount),
        )
          ? content.reportedSubject
          : undefined,
      });
    });

    const payloadCasts = casts?.map((cast) =>
      this.toCastPayload({
        content: cast,
        engagements: engagementsOriginal,
        metrics: metricsOriginal?.find(
          (metric) => String(metric._id) === cast.id,
        ),
      }),
    );

    const relationships = requestedBy
      ? await this.repository.findRelationships({
          userId: requestedBy._id,
          followedUser: authors.map((item) => item.id) as any,
        })
      : [];

    const includesUsers = authors?.map((author) => {
      const relationship = relationships?.find(
        (relationship) =>
          String(relationship.followedUser) === String(author.id),
      );

      return new Author(author).toIncludeUser(
        hasRelationshipExpansion
          ? {
              blocked: relationship?.blocking ?? false,
              followed: relationship?.following ?? false,
            }
          : {},
      );
    });

    return {
      payload: payloadContents,
      includes: new CastcleIncludes({
        casts: payloadCasts as any,
        users: includesUsers,
      }),
      meta: Meta.fromDocuments(payloadContents),
    };
  };

  private toContentResponse = async (
    {
      contents,
      casts,
      authors,
      engagements,
      metrics,
      engagementsOriginal,
      metricsOriginal,
    }: GetCastDto,
    hasRelationshipExpansion?: boolean,
    requestedBy?: User,
  ) => {
    const { payload, ...contentPayload } = await this.toContentsResponses(
      {
        contents,
        casts,
        authors,
        engagements,
        metrics,
        engagementsOriginal,
        metricsOriginal,
      },
      hasRelationshipExpansion,
      requestedBy,
    );
    return ResponseDto.ok({
      payload: Object.assign({}, ...payload),
      includes: contentPayload.includes,
    });
  };

  sortContentsByScore = async (accountId: string, contents: Content[]) => {
    const contentIds = contents.map((content) => content._id);
    const score = await this.dataService.personalizeContents(
      accountId,
      contentIds,
    );

    return score;
  };

  private getContentMore = (contents: GetCastDto, contentsMore: GetCastDto) => {
    contents.contents = [...contents.contents, ...contentsMore.contents];

    contents.casts = [
      ...contents.casts,
      ...contentsMore.casts.filter((cast) =>
        contents.casts.find((item) => String(cast._id) !== String(item._id)),
      ),
    ];

    contents.authors = [
      ...contents.authors,
      ...contentsMore.authors.filter((author) =>
        contents.authors.find((item) => String(author.id) !== String(item.id)),
      ),
    ];

    contents.engagements = [
      ...contents.engagements,
      ...contentsMore.engagements.filter((engagement) =>
        contents.engagements.find(
          (item) => String(engagement._id) !== String(item._id),
        ),
      ),
    ];

    contents.engagementsOriginal = [
      ...contents.engagementsOriginal,
      ...contentsMore.engagementsOriginal.filter((engagementOriginal) =>
        contents.engagementsOriginal.find(
          (item) => String(engagementOriginal._id) !== String(item._id),
        ),
      ),
    ];

    contents.metrics = [
      ...contents.metrics,
      ...contentsMore.metrics.filter((metric) =>
        contents.metrics.find(
          (item) => String(metric._id) !== String(item._id),
        ),
      ),
    ];

    contents.metricsOriginal = [
      ...contents.metricsOriginal,
      ...contentsMore.metricsOriginal.filter((metricOriginal) =>
        contents.metricsOriginal.find(
          (item) => String(metricOriginal._id) !== String(item._id),
        ),
      ),
    ];
    return contents;
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
    const [contents] = await this.repository.aggregationContent({
      viewer: user,
      _id: contentId,
      isRecast: true,
    });

    return this.toContentResponse(contents);
  };

  getQuoteCastPipeline = async (contentId: string, user: User) => {
    const [contents] = await this.repository.aggregationContent({
      viewer: user,
      _id: contentId,
      isQuote: true,
    });

    return this.toContentResponse(contents);
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
    const balance = await this.tAccountService.getAccountBalance(
      userId,
      WalletType.PERSONAL,
    );
    const lockBalance = await this.tAccountService.getAccountBalance(
      userId,
      WalletType.FARM_LOCKED,
    );

    if (balance >= (lockBalance + balance) * 0.05) {
      const farmAmount = new Types.Decimal128(
        ((lockBalance + balance) * 0.05).toString(),
      );
      const session = await this.contentFarmingModel.startSession();
      const contentFarming = await new this.contentFarmingModel({
        content: new Types.ObjectId(contentId),
        user: new Types.ObjectId(userId),
        status: ContentFarmingStatus.Farming,
        farmAmount: farmAmount,
        startAt: new Date(),
      });
      try {
        session.startTransaction();
        await contentFarming.save();
        await this.tAccountService.transfer({
          from: {
            type: WalletType.PERSONAL,
            user: new Types.ObjectId(userId),
            value: farmAmount,
          },
          to: [
            {
              type: WalletType.FARM_LOCKED,
              user: new Types.ObjectId(userId),
              value: farmAmount,
            },
          ],
          type: TransactionType.FARMING,
          status: TransactionStatus.VERIFIED,
          ledgers: [
            {
              debit: {
                cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
                value: farmAmount,
              },
              credit: {
                cAccountNo: CAccountNo.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: farmAmount,
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
    const balance = await this.tAccountService.getAccountBalance(
      String(contentFarming.user),
      WalletType.PERSONAL,
    );
    const lockBalance = await this.tAccountService.getAccountBalance(
      String(contentFarming.user),
      WalletType.FARM_LOCKED,
    );
    if (balance >= (lockBalance + balance) * 0.05) {
      const farmAmount = new Types.Decimal128(
        ((lockBalance + balance) * 0.05).toString(),
      );
      const session = await this.contentFarmingModel.startSession();
      contentFarming.farmAmount = farmAmount;
      await session.withTransaction(async () => {
        await contentFarming.save();
        await this.tAccountService.transfer({
          from: {
            type: WalletType.PERSONAL,
            user: contentFarming.user,
            value: farmAmount,
          },
          to: [
            {
              type: WalletType.FARM_LOCKED,
              user: contentFarming.user,
              value: farmAmount,
            },
          ],
          type: TransactionType.FARMING,
          status: TransactionStatus.VERIFIED,
          ledgers: [
            {
              debit: {
                cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
                value: farmAmount,
              },
              credit: {
                cAccountNo: CAccountNo.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: farmAmount,
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
    });
    await session.endSession();
    return contentFarming;
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
    const [[balance], content] = await Promise.all([
      this.repository.aggregateTransaction(new Types.ObjectId(userId)),
      this.repository.findContent({
        _id: contentFarming.content as any,
      }),
    ]);

    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const contentPayload = contentFarming.content
      ? this.toCastPayload({ content })
      : undefined;

    const user = await this.repository.findUser({
      _id: content.author.id,
    });

    const relationships = await this.repository.findRelationships({
      userId: userId as any,
      followedUser: [user._id],
    });

    const relationship = relationships?.find(
      (relationship) =>
        String(relationship.followedUser) === String(content?.author?.id),
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
        totalContentFarming,
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
    const [contents] = await this.repository.aggregationContent({
      viewer: viewer,
      originalPost: contentId,
      maxResults: query.maxResults,
      sinceId: query.sinceId,
      untilId: query.untilId,
      isQuote: true,
    });

    return this.toContentsResponses(
      contents,
      query.hasRelationshipExpansion,
      viewer,
    );
  };

  getUserContents = async (
    { hasRelationshipExpansion, ...query }: PaginationQuery,
    user: User,
    requestedBy?: User,
  ) => {
    const [contents] = await this.repository.aggregationContent({
      viewer: requestedBy,
      author: user._id,
      visibility:
        String(user.ownerAccount) === String(requestedBy?.ownerAccount)
          ? [EntityVisibility.Publish, EntityVisibility.Illegal]
          : undefined,
      ...query,
    });

    return this.toContentsResponses(
      contents,
      hasRelationshipExpansion,
      requestedBy,
    );
  };

  getContent = async (
    contentId: string,
    requestedBy?: User,
    hasRelationshipExpansion?: boolean,
  ) => {
    const [contents] = await this.repository.aggregationContent({
      viewer: requestedBy,
      _id: contentId,
      visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
    });

    if (
      contents.contents?.some(
        (content) =>
          requestedBy?.id !== String(content.author.id) &&
          content.visibility === EntityVisibility.Illegal,
      )
    )
      throw new CastcleException('CONTENT_NOT_FOUND');

    return this.toContentResponse(
      contents,
      hasRelationshipExpansion,
      requestedBy,
    );
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
    return this.toContentResponse({
      contents: [content],
      authors: [author as any],
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

  getSearchRecent = async (
    { hasRelationshipExpansion, ...query }: GetSearchQuery,
    viewer?: User,
  ) => {
    const blocking = await this.userServiceV2.getUserRelationships(
      viewer,
      true,
    );

    let [contents] = await this.repository.aggregationContent({
      viewer,
      excludeAuthor: blocking,
      ...query,
    });

    if (
      contents.contents.length &&
      contents.contents.length < query.maxResults
    ) {
      const [contentsMore] = await this.repository.aggregationContent({
        viewer,
        maxResults: query.maxResults - contents.contents.length,
        excludeContents: contents.contents.map((content) => content._id),
        excludeAuthor: blocking,
        contentType: query.contentType,
      });

      contents = this.getContentMore(contents, contentsMore);
    }

    return this.toContentsResponses(contents, hasRelationshipExpansion, viewer);
  };
  getSearchTrends = async (
    {
      hasRelationshipExpansion,
      maxResults,
      sinceId,
      untilId,
      ...query
    }: GetSearchQuery,
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

    let [contents] = await this.repository.aggregationContent({
      viewer,
      maxResults: maxResults,
      _id: contentsId.map((content) => content._id),
      excludeAuthor: blocking,
      contentType: query.contentType,
      ...query,
    });

    if (!account.isGuest)
      contents.contents = contents.contents.sort(
        (a, b) => contentScore[String(b._id)] - contentScore[String(a._id)],
      );

    if (contents.contents.length && contents.contents.length < maxResults) {
      const [contentsMore] = await this.repository.aggregationContent({
        viewer,
        maxResults: maxResults - contents.contents.length,
        excludeContents: contents.contents.map((content) => content._id),
        decayDays: Environment.DECAY_DAY_CONTENT,
        excludeAuthor: blocking,
      });

      if (!account.isGuest) {
        const score = await this.sortContentsByScore(
          account._id,
          contentsMore.contents,
        );

        contentsMore.contents = contentsMore.contents.sort(
          (a, b) => score[String(b._id)] - score[String(a._id)],
        );
      }

      contents = this.getContentMore(contents, contentsMore);
    }
    return this.toContentsResponses(contents, hasRelationshipExpansion, viewer);
  };

  getRecentContents = async (
    { maxResults }: FeedQuery,
    accountId: string,
    viewer: User,
  ) => {
    const suggestContents = await this.dataService.suggestContents(
      accountId,
      maxResults,
    );
    const suggestContentIds = suggestContents.payload.map((c) => c.content);
    const [contents] = await this.repository.aggregationContent({
      viewer,
      maxResults: maxResults,
      _id: suggestContentIds,
    });
    contents.calledContents = [];
    contents.newContents = [];
    for (let i = 0; i < (contents as GetCastDto).contents.length; i++) {
      const isCalled =
        suggestContents.payload.findIndex(
          (p) =>
            p.calledAt &&
            String(p.content) ===
              String((contents as GetCastDto).contents[i]._id),
        ) >= 0;
      if (isCalled)
        contents.calledContents.push((contents as GetCastDto).contents[i]);
      else contents.newContents.push((contents as GetCastDto).contents[i]);
    }
    return contents as GetCastDto;
  };

  toFeedResponse = async (
    contentsCastDto: GetCastDto,
    feedItems: FeedItem[],
    viewer: User,
    hasRelationshipExpansion: boolean,
  ) => {
    const { payload, ...contentsResponse } = await this.toContentsResponses(
      contentsCastDto,
      hasRelationshipExpansion,
      viewer,
    );
    return {
      payload: feedItems.map(
        (feed) =>
          ({
            id: feed.id,
            type: 'content',
            feature: {
              slug: 'feed',
              key: 'feature.feed',
              name: 'Feed',
            },
            circle: {
              id: 'for-you',
              key: 'circle.forYou',
              name: 'For You',
              slug: 'forYou',
            },
            payload: payload.find(
              (content) => String(content.id) === String(feed.content),
            ),
          } as FeedItemPayloadItem),
      ),
      ...contentsResponse,
    } as FeedItemResponse;
  };

  generateFeeds = async (
    { hasRelationshipExpansion, maxResults, ...query }: FeedQuery,
    accountId: string,
    viewer: User,
  ) => {
    const contentsCastDto = await this.getRecentContents(
      { hasRelationshipExpansion, maxResults, ...query },
      accountId,
      viewer,
    );
    const newFeeds = await this.repository.saveFeedItemFromContents(
      contentsCastDto,
      accountId,
    );
    return this.toFeedResponse(
      contentsCastDto,
      newFeeds,
      viewer,
      hasRelationshipExpansion,
    );
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

    const { payload } = await this.toContentResponse({
      contents: [targetContent],
      authors: [],
    });

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
          content: this.mailerService.generateHTMLReport(payload, {
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
          }),
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

    const { payload } = await this.toContentResponse({
      contents: [content],
      authors: [],
    });

    const reportingSubject = await this.repository.findReportingSubject({
      type: MetadataType.REPORTING_SUBJECT,
      subject: reporting.subject,
    });

    await this.reportingQueue.add(
      {
        subject: `${ReportingAction.APPEAL} content : (OID : ${content._id})`,
        content: this.mailerService.generateHTMLReport(payload, {
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
        }),
      },
      {
        removeOnComplete: true,
      },
    );
  };

  lookupFarming = async (contentId: string, user: User) => {
    const contentFarming = await this.contentFarmingModel.findOne(
      {
        user: new Types.ObjectId(user.id),
        content: new Types.ObjectId(contentId),
      },
      {
        updatedAt: 0,
        endedAt: 0,
      },
    );

    const [balance] = await this.repository.aggregateTransaction(user._id);
    if (
      contentFarming &&
      contentFarming?.status !== ContentFarmingStatus.Farming
    ) {
      contentFarming._id = null;
      contentFarming.createdAt = null;
      if (contentFarming.status === ContentFarmingStatus.Farmed)
        contentFarming.status = undefined;
    }

    const content = await this.repository.findContent({
      _id: contentId as any,
    });

    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const author = await this.repository.findUser({ _id: content.author.id });

    if (!author) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    if (String(author.ownerAccount) === String(user.ownerAccount))
      throw new CastcleException('CAN_NOT_FARMING_YOUR_CAST');

    const engagements = await this.repository.findEngagements({
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: contentId,
      },
    });

    const relationships = await this.repository.findRelationships({
      userId: user._id,
      followedUser: [author._id],
    });

    const relationship = relationships?.find(
      (relationship) => String(relationship.followedUser) === author.id,
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
        content ? this.toCastPayload({ content, engagements }) : undefined,
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

    const [{ contents, engagements }] =
      await this.repository.aggregationContent({
        _id: contentFarmings.map(({ content }) => content as unknown as string),
        viewer,
      });

    const users = await this.repository.findUsers({
      _id: contents.map(({ author }) => author.id),
    });

    const relationships = await this.repository.findRelationships({
      userId: viewer._id,
      followedUser: contents.map(({ author }) => author.id),
    });

    const farmingPayload = await Promise.all(
      contentFarmings.map(async (contentFarming, index) => {
        const content = contents.find(
          (content) => String(content._id) === String(contentFarming.content),
        );

        return new ContentFarmingResponse(
          contentFarming,
          Number(balance?.total).toFixed(Environment.DECIMALS_FLOAT),
          Number(balance?.farm).toFixed(Environment.DECIMALS_FLOAT),
          Number(balance?.available).toFixed(Environment.DECIMALS_FLOAT),
          totalContentFarming - index,
          content ? this.toCastPayload({ content, engagements }) : undefined,
        );
      }),
    );

    const includesUsers = users.map((user) => {
      const relationship = relationships?.find(
        (relationship) => String(relationship.user) === String(viewer.id),
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

    const [{ contents, engagements }] =
      await this.repository.aggregationContent({
        _id: contentFarmings.map(({ content }) => content as unknown as string),
        viewer,
      });

    const users = await this.repository.findUsers({
      _id: contents.map(({ author }) => author.id),
    });

    const relationships = await this.repository.findRelationships({
      userId: viewer._id,
      followedUser: contents.map(({ author }) => author.id),
    });

    const farmingPayload = await Promise.all(
      contentFarmings.map(async (contentFarming) => {
        const content = contents.find(
          (content) => String(content._id) === String(contentFarming.content),
        );

        return new ContentFarmingResponse(
          contentFarming,
          Number(balance?.total).toFixed(Environment.DECIMALS_FLOAT),
          Number(balance?.farm).toFixed(Environment.DECIMALS_FLOAT),
          Number(balance?.available).toFixed(Environment.DECIMALS_FLOAT),
          undefined,
          content ? this.toCastPayload({ content, engagements }) : undefined,
        );
      }),
    );
    const includesUsers = users.map((user) => {
      const relationship = relationships?.find(
        (relationship) => String(relationship.user) === String(viewer.id),
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
