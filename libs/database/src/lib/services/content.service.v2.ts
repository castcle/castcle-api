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
  EngagementType,
  UserType,
  WalletType,
} from '../models';
import { Account, Content, ContentFarming, User } from '../schemas';
import { CastcleException } from '@castcle-api/utils/exception';
import { NotificationServiceV2 } from './notification.service.v2';
import {
  Author,
  ContentType,
  EntityVisibility,
  NotificationSource,
  NotificationType,
  PaginationQuery,
  ShortPayload,
} from '../dtos';
import { Types } from 'mongoose';
import { TAccountService } from './taccount.service';
import {
  ContentFarmingCDF,
  ContentFarmingReponse,
} from '../models/content-farming.model';
import { Repository } from '../repositories';
import { Environment } from '@castcle-api/environments';

import { UserService } from './user.service';
import cdf from 'castcle-cdf';

@Injectable()
export class ContentServiceV2 {
  constructor(
    private notificationServiceV2: NotificationServiceV2,
    private taccountService: TAccountService,
    private repository: Repository,
    @InjectModel('ContentFarming')
    private contentFarmingModel: Model<ContentFarming>,
    @InjectModel('Content')
    private contentModel: Model<Content>
  ) {}

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
        account.preferences.languages[0]
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
      }
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
    if (!recastContent) throw CastcleException.SOMETHING_WRONG;

    const engagement = await this.repository.createEngagement({
      type: EngagementType.Recast,
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: sourceContentId,
      },
      itemId: recastContent._id,
      visibility: EntityVisibility.Publish,
    });
    if (!engagement) throw CastcleException.SOMETHING_WRONG;

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
        account.preferences.languages[0]
      );

    return { recastContent, engagement };
  };

  undoRecast = async (contentId: string, user: User) => {
    const content = await this.repository.findContent({
      _id: contentId,
      author: user._id,
    });

    if (!content) throw CastcleException.CONTENT_NOT_FOUND;

    const engagement = await this.repository.findEngagement({
      user: user._id,
      itemId: contentId,
      type: EngagementType.Recast,
    });

    if (content.hashtags) {
      await this.repository.removeFromTags(content.hashtags, {
        $inc: {
          score: -1,
        },
      });
    }

    if (!engagement) return;
    await this.repository.updateNotification(
      {
        type: NotificationType.Recast,
        contentRef: Types.ObjectId(contentId),
        commentRef: { $exists: false },
        replyRef: { $exists: false },
      },
      {
        $pull: { sourceUserId: { $eq: user._id } },
      }
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

  createContentFarming = async (contentId: string, accountId: string) => {
    const balance = await this.taccountService.getAccountBalance(
      accountId,
      WalletType.PERSONAL
    );
    const lockBalance = await this.taccountService.getAccountBalance(
      accountId,
      WalletType.FARM_LOCKED
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
      WalletType.PERSONAL
    );
    const lockBalance = await this.taccountService.getAccountBalance(
      String(contentFarming.account),
      WalletType.FARM_LOCKED
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
          }
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
        }
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
      new Date().getTime() - Environment.CONTENT_FARMING_COOLDOWN_HR * 60 * 1000
    );
    const expiresFarmings = await this.contentFarmingModel.find({
      status: ContentFarmingStatus.Farming,
      startAt: { $lte: cutOffDate },
    });
    return Promise.all(
      expiresFarmings.map((cf) =>
        this.expireFarm(String(cf.content), String(cf.account))
      )
    );
  };

  getUndistributedContentFarmingCDF = async () => {
    //const prospectContentFarmings = await this.contentFarmingModel.find({isDistributed: {$ne:true}},{ }, {sort: 'startAt:1'} );
    const contents = await this.contentModel.find({
      farming: { $exists: true },
      'farming.isDistributed': { $ne: true },
    });
    const result: ContentFarmingCDF[] = [];
    contents.forEach((item) => {
      result.push({
        contentId: item.id,
        contentFarmings: item.farming,
      });
    });
    return result;
  };

  findCumulativeStats = (contentFarmingCDF: ContentFarmingCDF) => {
    const totalFarmedToken = contentFarmingCDF.contentFarmings.reduce(
      (prev, now) => prev + now.farmAmount,
      0
    );
    const FIX_CONST = 0.9340119642;
    let cumulativeTotal = 0;
    contentFarmingCDF.contentFarmings = contentFarmingCDF.contentFarmings.map(
      (item) => {
        cumulativeTotal += item.farmAmount;
        item.cdfStat.cumulativeOrder = cumulativeTotal / totalFarmedToken;
        item.cdfStat.cumulativeDistributed = cdf(
          item.cdfStat.cumulativeOrder,
          Math.E
        );
        item.cdfStat.adjustedCumulative =
          item.cdfStat.cumulativeDistributed / FIX_CONST;
        return item;
      }
    );
    return contentFarmingCDF;
  };

  findWeight = (contentFarmingCDF: ContentFarmingCDF) => {
    contentFarmingCDF.contentFarmings = contentFarmingCDF.contentFarmings.map(
      (item, index) => {
        if (index == 0) {
          item.weight = item.cdfStat.adjustedCumulative;
        } else {
          item.weight =
            item.cdfStat.adjustedCumulative -
            contentFarmingCDF.contentFarmings[index - 1].cdfStat
              .adjustedCumulative;
        }
        return item;
      }
    );
    return contentFarmingCDF;
  };

  updateContentFarmingCDFStat = (contentFarmingCDF: ContentFarmingCDF) => {
    return Promise.all(
      contentFarmingCDF.contentFarmings.map((item) => {
        item.markModified('cdfStat');
        return item.save();
      })
    );
  };

  updateAllUndistributedContentFarming = async () => {
    const contentFarmingCDFs = await this.getUndistributedContentFarmingCDF();
    return Promise.all(
      contentFarmingCDFs.map((item) => {
        item = this.findCumulativeStats(item);
        item = this.findWeight(item);
        return this.updateContentFarmingCDFStat(item);
      })
    );
  };

  pipeContentFarming = async (
    contentFarming: ContentFarming,
    accountId: string
  ) => {
    const balance = await this.taccountService.getAccountBalance(
      accountId,
      WalletType.PERSONAL
    );
    const lockBalance = await this.taccountService.getAccountBalance(
      accountId,
      WalletType.FARM_LOCKED
    );
    const totalContentFarming = await this.contentFarmingModel.count({
      account: accountId,
    });
    return new ContentFarmingReponse(
      contentFarming,
      balance,
      lockBalance,
      totalContentFarming
    );
  };

  getEngagementCast = async (
    contentId: string,
    account: Account,
    query: PaginationQuery,
    type: EngagementType,
    viewer?: User
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
    const engagementCounts = await this.repository.countEngagements(filter);

    const engagementDocuments = await this.repository.findEngagements(
      { ...query, ...filter },
      {
        limit: query.maxResults,
        sort: { createdAt: -1 },
        populate: 'user',
      }
    );

    if (!engagementDocuments.length)
      return {
        items: [],
        count: 0,
      };

    if (!query.hasRelationshipExpansion || account.isGuest) {
      const engagementResponse = await Promise.all(
        engagementDocuments.map(async (engagement) => {
          return engagement.user.type === UserType.PAGE
            ? engagement.user.toPageResponseV2()
            : await engagement.user.toUserResponseV2();
        })
      );
      return {
        items: engagementResponse,
        count: engagementCounts,
      };
    }

    const relationshipUser = engagementDocuments.map((item) => item.user?._id);

    const relationships = await this.repository
      .findRelationships({
        userId: relationshipUser,
      })
      .exec();
    const relationship = relationships?.find(
      (relationship) => String(relationship.user) === String(viewer?._id)
    );

    const engagementResponse = await Promise.all(
      engagementDocuments
        .filter((item) => item.user)
        .map(async (engagement) => {
          return engagement.user.type === UserType.PAGE
            ? engagement.user.toPageResponseV2(
                relationship?.blocking ?? false,
                relationship?.blocking ?? false,
                relationship?.following ?? false
              )
            : await engagement.user.toUserResponseV2({
                blocked: relationship?.blocking ?? false,
                blocking: relationship?.blocking ?? false,
                followed: relationship?.following ?? false,
              });
        })
    );
    return {
      items: engagementResponse,
      count: engagementCounts,
    };
  };
}
