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
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CACCOUNT_NO,
  ContentFarmingStatus,
  ContentMessage,
  ContentMessageEvent,
  EngagementType,
  QueueName,
  UserType,
  WalletType,
} from '../models';
import {
  Account,
  Content,
  ContentFarming,
  signedContentPayloadItem,
  toUnsignedContentPayloadItem,
  User,
} from '../schemas';
import { CastcleException } from '@castcle-api/utils/exception';
import { NotificationServiceV2 } from './notification.service.v2';
import {
  Author,
  CastcleIncludes,
  ContentType,
  CreateContentDto,
  EntityVisibility,
  GetContentCastDto,
  Meta,
  NotificationSource,
  NotificationType,
  PaginationQuery,
  ResponseDto,
  ResponseParticipate,
  ShortPayload,
} from '../dtos';
import { Types } from 'mongoose';
import { TAccountService } from './taccount.service';
import { ContentFarmingReponse } from '../models/content-farming.model';
import { Repository } from '../repositories';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { HashtagService } from './hashtag.service';

@Injectable()
export class ContentServiceV2 {
  private logger = new CastLogger(ContentServiceV2.name);
  constructor(
    private notificationServiceV2: NotificationServiceV2,
    private taccountService: TAccountService,
    private repository: Repository,
    @InjectModel('ContentFarming')
    private contentFarmingModel: Model<ContentFarming>,
    @InjectModel('Content')
    private contentModel: Model<Content>,
    private hashtagService: HashtagService,
    @InjectQueue(QueueName.CONTENT)
    private contentQueue: Queue<ContentMessage>,
  ) {}

  toContentsResponses = async (
    bundleContents: GetContentCastDto,
    hasRelationshipExpansion?: boolean,
    viewer?: User,
    countContents?: number,
  ) => {
    const payloadContents = bundleContents.contents.map((content) =>
      signedContentPayloadItem(
        toUnsignedContentPayloadItem(
          content,
          bundleContents.engagements,
          bundleContents.metrics?.find(
            (metric) => String(metric._id) === String(content._id),
          ),
        ),
      ),
    );

    if (!bundleContents.contents)
      return ResponseDto.ok({
        payload: [],
        includes: { casts: [], users: [] },
        meta: { resultCount: 0 },
      });

    const usersId = bundleContents.authors.map((item) => item._id);

    const relationships = hasRelationshipExpansion
      ? await this.repository
          .findRelationships({
            userId: viewer._id,
            followedUser: usersId,
          })
          .exec()
      : [];

    const includesUsers = bundleContents.authors.map((author) => {
      const relationshipUser = relationships?.find(
        (relationship) =>
          String(relationship.followedUser) === String(author._id),
      );
      return new Author(author as any).toIncludeUser({
        blocked: hasRelationshipExpansion
          ? relationshipUser?.blocking ?? false
          : undefined,
        blocking: hasRelationshipExpansion
          ? relationshipUser?.blocking ?? false
          : undefined,
        followed: hasRelationshipExpansion
          ? relationshipUser?.following ?? false
          : undefined,
      });
    });

    const payloadCasts = bundleContents.casts?.map((cast) =>
      signedContentPayloadItem(
        toUnsignedContentPayloadItem(
          cast,
          bundleContents.engagementsOriginal,
          bundleContents.metricsOriginal?.find(
            (metric) => String(metric._id) === String(cast._id),
          ),
        ),
      ),
    );

    return {
      payload: payloadContents,
      includes: new CastcleIncludes({
        casts: payloadCasts,
        users: includesUsers,
      }),
      meta: Meta.fromDocuments(payloadContents as any, countContents),
    } as ResponseDto;
  };

  toContentResponse = async (
    bundleContents: GetContentCastDto,
    hasRelationshipExpansion?: boolean,
    viewer?: User,
  ) => {
    const [payloadContent] = bundleContents.contents.map((content) =>
      signedContentPayloadItem(
        toUnsignedContentPayloadItem(
          content,
          bundleContents.engagements,
          bundleContents.metrics?.find(
            (metric) => String(metric._id) === String(content._id),
          ),
        ),
      ),
    );

    if (!bundleContents.contents)
      return ResponseDto.ok({
        payload: [],
        includes: { casts: [], users: [] },
        meta: { resultCount: 0 },
      });

    const usersId = bundleContents.authors.map((item) => item._id);

    const relationships = hasRelationshipExpansion
      ? await this.repository
          .findRelationships({
            userId: viewer._id,
            followedUser: usersId,
          })
          .exec()
      : [];

    const includesUsers = bundleContents.authors.map((author) => {
      const relationshipUser = relationships?.find(
        (relationship) =>
          String(relationship.followedUser) === String(author._id),
      );
      return new Author(author as any).toIncludeUser({
        blocked: hasRelationshipExpansion
          ? relationshipUser?.blocked ?? false
          : undefined,
        blocking: hasRelationshipExpansion
          ? relationshipUser?.blocking ?? false
          : undefined,
        followed: hasRelationshipExpansion
          ? relationshipUser?.following ?? false
          : undefined,
      });
    });

    const payloadCasts = bundleContents.casts?.map((cast) =>
      signedContentPayloadItem(
        toUnsignedContentPayloadItem(
          cast,
          bundleContents.engagementsOriginal,
          bundleContents.metricsOriginal?.find(
            (metric) => String(metric._id) === String(cast._id),
          ),
        ),
      ),
    );

    return {
      payload: payloadContent,
      includes: new CastcleIncludes({
        casts: payloadCasts,
        users: includesUsers,
      }),
    } as ResponseDto;
  };

  likeCast = async (contentId: string, user: User, account: Account) => {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw CastcleException.CONTENT_NOT_FOUND;
    const engagement = await this.repository.findEngagement({
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
      type: EngagementType.Like,
    });

    if (engagement) throw CastcleException.LIKE_IS_EXIST;

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
      await this.notificationServiceV2.notifyToUser(
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
        $id: Types.ObjectId(contentId),
      },
      type: EngagementType.Like,
    });

    if (!engagement) return;
    await this.repository.updateNotification(
      {
        type: NotificationType.Like,
        contentRef: Types.ObjectId(contentId),
        commentRef: { $exists: false },
        replyRef: { $exists: false },
      },
      {
        $pull: { sourceUserId: { $eq: user._id } },
      },
    );
    const notification = await this.repository.findNotification({
      type: NotificationType.Like,
      contentRef: Types.ObjectId(contentId),
      commentRef: { $exists: false },
      replyRef: { $exists: false },
    });

    if (notification && !notification?.sourceUserId?.length)
      await notification.remove();

    return engagement.remove();
  };

  getRecastPipeline = async (contentId: string, user: User) => {
    const [bundleContents] = await this.repository.aggregationContent({
      viewer: user,
      _id: contentId,
      isRecast: true,
    });

    return this.toContentResponse(bundleContents);
  };

  getQuoteCastPipeline = async (contentId: string, user: User) => {
    const [bundleContents] = await this.repository.aggregationContent({
      viewer: user,
      _id: contentId,
      isQuote: true,
    });

    return this.toContentResponse(bundleContents);
  };

  recast = async (contentId: string, user: User, account: Account) => {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw CastcleException.CONTENT_NOT_FOUND;

    const originalContent = await this.repository.findContent({
      originalPost: contentId,
      author: user._id,
      isRecast: true,
    });

    if (originalContent) throw CastcleException.RECAST_IS_EXIST;

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
    if (!recastContent) throw CastcleException.CONTENT_NOT_FOUND;

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
      await this.notificationServiceV2.notifyToUser(
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
    });

    if (!content) throw CastcleException.CONTENT_NOT_FOUND;

    const engagement = await this.repository.findEngagement({
      user: user._id,
      itemId: content._id,
      type: EngagementType.Recast,
    });

    if (content.hashtags) {
      await this.repository.removeFromTags(content.hashtags, {
        $inc: {
          score: -1,
        },
      });
    }

    await this.repository.updateNotification(
      {
        type: NotificationType.Recast,
        contentRef: Types.ObjectId(contentId),
        commentRef: { $exists: false },
        replyRef: { $exists: false },
      },
      {
        $pull: { sourceUserId: { $eq: user._id } },
      },
    );
    const notification = await this.repository.findNotification({
      type: NotificationType.Recast,
      contentRef: Types.ObjectId(contentId),
      commentRef: { $exists: false },
      replyRef: { $exists: false },
    });

    if (notification && !notification?.sourceUserId?.length)
      await notification.remove();

    return Promise.all([content.remove(), engagement.remove()]);
  };

  quoteCast = async (
    contentId: string,
    message: string,
    user: User,
    account: Account,
  ) => {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw CastcleException.CONTENT_NOT_FOUND;

    const originalContent = await this.repository.findContent({
      originalPost: contentId,
      author: user._id,
      isQuote: true,
      message,
    });

    if (originalContent) throw CastcleException.QUOTE_IS_EXIST;

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
    if (!quoteContent) throw CastcleException.CONTENT_NOT_FOUND;

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
      await this.notificationServiceV2.notifyToUser(
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

  createContentFarming = async (contentId: string, accountId: string) => {
    const balance = await this.taccountService.getAccountBalance(
      accountId,
      WalletType.PERSONAL,
    );
    const lockBalance = await this.taccountService.getAccountBalance(
      accountId,
      WalletType.FARM_LOCKED,
    );

    if (balance >= (lockBalance + balance) * 0.05) {
      //can farm
      const farmAmount = (lockBalance + balance) * 0.05;
      const session = await this.contentFarmingModel.startSession();
      const contentFarming = await new this.contentFarmingModel({
        content: contentId,
        account: accountId,
        status: ContentFarmingStatus.Farming,
        farmAmount: farmAmount,
        startAt: new Date(),
      });

      await session.withTransaction(async () => {
        await contentFarming.save();
        await this.taccountService.transfers({
          from: {
            type: WalletType.PERSONAL,
            account: accountId,
            value: farmAmount,
          },
          to: [
            {
              type: WalletType.FARM_LOCKED,
              account: accountId,
              value: farmAmount,
            },
          ],
          ledgers: [
            {
              debit: {
                caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
                value: farmAmount,
              },
              credit: {
                caccountNo: CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: farmAmount,
              },
            },
          ],
        });
      });
      session.endSession();
      return contentFarming;
    } else {
      //throw error
      throw CastcleException.CONTENT_FARMING_NOT_AVAIABLE_BALANCE;
    }
  };

  updateContentFarming = async (contentFarming: ContentFarming) => {
    contentFarming.status = ContentFarmingStatus.Farming;
    contentFarming.startAt = new Date();
    const balance = await this.taccountService.getAccountBalance(
      String(contentFarming.account),
      WalletType.PERSONAL,
    );
    const lockBalance = await this.taccountService.getAccountBalance(
      String(contentFarming.account),
      WalletType.FARM_LOCKED,
    );
    if (balance >= (lockBalance + balance) * 0.05) {
      const farmAmount = (lockBalance + balance) * 0.05;
      const session = await this.contentFarmingModel.startSession();
      contentFarming.farmAmount = farmAmount;
      await session.withTransaction(async () => {
        await contentFarming.save();
        await this.taccountService.transfers({
          from: {
            type: WalletType.PERSONAL,
            account: String(contentFarming.account),
            value: farmAmount,
          },
          to: [
            {
              type: WalletType.FARM_LOCKED,
              account: String(contentFarming.account),
              value: farmAmount,
            },
          ],
          ledgers: [
            {
              debit: {
                caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
                value: farmAmount,
              },
              credit: {
                caccountNo: CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: farmAmount,
              },
            },
          ],
        });
      });
      session.endSession();
      return contentFarming;
    } else {
      //thorw error
      throw CastcleException.CONTENT_FARMING_NOT_AVAIABLE_BALANCE;
    }
  };

  checkFarming = (contentFarming: ContentFarming) => {
    if (
      contentFarming &&
      contentFarming.status === ContentFarmingStatus.Farmed &&
      contentFarming.endedAt &&
      contentFarming.endedAt.getTime() - contentFarming.startAt.getTime() >=
        24 * 60 * 60 * 1000
    )
      return true;
    else if (
      contentFarming &&
      contentFarming.status === ContentFarmingStatus.Farmed
    )
      throw CastcleException.CONTENT_FARMING_ALREDY_FARM;
    else if (!contentFarming) return false;
    else throw CastcleException.CONTENT_FARMING_LIMIT;
  };

  getContentFarming = async (contentId: string, accountId: string) =>
    this.contentFarmingModel.findOne({
      content: contentId,
      account: accountId,
    });

  farm = async (contentId: string, accountId: string) => {
    const contentFarming = await this.getContentFarming(contentId, accountId);
    if (this.checkFarming(contentFarming)) {
      return this.updateContentFarming(contentFarming);
    } else return this.createContentFarming(contentId, accountId);
  };

  unfarm = async (contentId: string, accountId: string) => {
    const contentFarming = await this.getContentFarming(contentId, accountId);
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
        await this.taccountService.transfers({
          from: {
            type: WalletType.FARM_LOCKED,
            account: String(contentFarming.account),
            value: contentFarming.farmAmount,
          },
          to: [
            {
              type: WalletType.PERSONAL,
              account: String(contentFarming.account),
              value: contentFarming.farmAmount,
            },
          ],
          ledgers: [
            {
              debit: {
                caccountNo: CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
                value: contentFarming.farmAmount,
              },
              credit: {
                caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
                value: contentFarming.farmAmount,
              },
            },
          ],
        });
      });
      session.endSession();
      return contentFarming;
    } else {
      throw CastcleException.CONTENT_FARMING_NOT_FOUND;
    }
  };

  //for system only
  expireFarm = async (contentId: string, accountId: string) => {
    //change status
    //move token from lock to personal
    const contentFarming = await this.getContentFarming(contentId, accountId);
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
      await this.taccountService.transfers({
        from: {
          type: WalletType.FARM_LOCKED,
          account: String(contentFarming.account),
          value: contentFarming.farmAmount,
        },
        to: [
          {
            type: WalletType.PERSONAL,
            account: String(contentFarming.account),
            value: contentFarming.farmAmount,
          },
        ],
        ledgers: [
          {
            debit: {
              caccountNo: CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.FARM,
              value: contentFarming.farmAmount,
            },
            credit: {
              caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
              value: contentFarming.farmAmount,
            },
          },
        ],
      });
    });
    session.endSession();
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
        this.expireFarm(String(cf.content), String(cf.account)),
      ),
    );
  };

  pipeContentFarming = async (
    contentFarming: ContentFarming,
    accountId: string,
  ) => {
    const balance = await this.taccountService.getAccountBalance(
      accountId,
      WalletType.PERSONAL,
    );
    const lockBalance = await this.taccountService.getAccountBalance(
      accountId,
      WalletType.FARM_LOCKED,
    );
    const totalContentFarming = await this.contentFarmingModel.count({
      account: accountId,
    });
    return new ContentFarmingReponse(
      contentFarming,
      balance,
      lockBalance,
      totalContentFarming,
    );
  };

  getEngagementCast = async (
    contentId: string,
    account: Account,
    query: PaginationQuery,
    type?: EngagementType,
    viewer?: User,
  ) => {
    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw CastcleException.CONTENT_NOT_FOUND;

    const filter = {
      targetRef: {
        $ref: 'content',
        $id: Types.ObjectId(contentId),
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
        usersEngagement.map(async ({ user }) => {
          return user.type === UserType.PAGE
            ? user.toPageResponseV2()
            : await user.toUserResponseV2();
        }),
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

    const userResponses = await Promise.all(
      usersEngagement.map(async ({ user }) => {
        return user.type === UserType.PAGE
          ? user.toPageResponseV2(
              relationship?.blocking ?? false,
              relationship?.blocking ?? false,
              relationship?.following ?? false,
            )
          : await user.toUserResponseV2({
              blocked: relationship?.blocking ?? false,
              blocking: relationship?.blocking ?? false,
              followed: relationship?.following ?? false,
            });
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
    const [bundleContents] = await this.repository.aggregationContent({
      viewer: viewer,
      originalPost: contentId,
      maxResults: query.maxResults,
      sinceId: query.sinceId,
      untilId: query.untilId,
      isQuote: true,
    });

    if (!bundleContents.contents.length)
      return ResponseDto.ok({
        payload: [],
        includes: { casts: [], users: [] },
        meta: { resultCount: 0 },
      });

    this.logger.log('Success get quote cast');

    return this.toContentsResponses(
      bundleContents,
      query.hasRelationshipExpansion,
      viewer,
    );
  };

  getContents = async (
    { hasRelationshipExpansion, ...query }: PaginationQuery,
    viewer?: User,
  ) => {
    const [bundleContents] = await this.repository.aggregationContent({
      viewer,
      ...query,
    });

    if (!bundleContents.contents.length)
      return ResponseDto.ok({
        payload: [],
        includes: { casts: [], users: [] },
        meta: { resultCount: 0 },
      });

    return this.toContentsResponses(
      bundleContents,
      hasRelationshipExpansion,
      viewer,
    );
  };

  getContent = async (
    contentId: string,
    viewer?: User,
    hasRelationshipExpansion?: boolean,
  ) => {
    const [bundleContents] = await this.repository.aggregationContent({
      viewer: viewer,
      _id: contentId,
    });
    return this.toContentResponse(
      bundleContents,
      hasRelationshipExpansion,
      viewer,
    );
  };

  createContent = async (body: CreateContentDto, user: User) => {
    const userAccess = await this.repository.findUser({
      _id: body.castcleId,
    });
    if (!userAccess) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    if (String(userAccess.ownerAccount) !== String(user.ownerAccount))
      throw CastcleException.FORBIDDEN;

    const convertImage = await this.repository.createContentImage(body, user);

    const hashtags = this.hashtagService.extractHashtagFromContentPayload(
      body.payload,
    );

    const author = new Author({
      id: user._id,
      avatar: user.profile?.images?.avatar || null,
      castcleId: user.displayId,
      displayName: user.displayName,
      type: user.type === UserType.PAGE ? UserType.PAGE : UserType.PEOPLE,
      verified: user.verified,
    });

    const newContent = {
      ...convertImage,
      author: author,
      payload: convertImage.payload,
      revisionCount: 0,
      type: convertImage.type,
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
    const content = await this.repository.findContent({
      _id: contentId,
      author: user._id,
    });
    if (!content) throw CastcleException.CONTENT_NOT_FOUND;

    await this.repository.updateContent(
      { _id: contentId },
      { $set: { visibility: EntityVisibility.Deleted } },
    );

    if (content.isRecast || content.isQuote)
      await this.repository.removeEngagements({ itemId: content._id });

    if (content.hashtags)
      await this.repository.removeFromTags(content.hashtags, {
        $inc: {
          score: -1,
        },
      });
  };

  getParticipates = async (contentId: string, account: Account) => {
    const users = await this.repository
      .findUsers({ accountId: account._id })
      .exec();

    if (!users.length) throw CastcleException.USER_OR_PAGE_NOT_FOUND;

    const userIds = users.map((user) => user._id);

    const content = await this.repository.findContent({ _id: contentId });
    if (!content) throw CastcleException.CONTENT_NOT_FOUND;

    const engagements = await this.repository.findEngagements({
      user: userIds,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
    });

    const userParticipates = users.map((user) => {
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
        ).participate,
      };
    });

    return userParticipates as ResponseParticipate[];
  };
}
