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
import { Account, Content, ContentFarming, Engagement, User } from '../schemas';
import { CastcleException } from '@castcle-api/utils/exception';
import { NotificationServiceV2 } from './notification.service.v2';
import {
  EntityVisibility,
  NotificationSource,
  NotificationType,
  PaginationQuery,
} from '../dtos';
import { Types } from 'mongoose';
import { TAccountService } from './taccount.service';
import { ContentFarmingReponse } from '../models/content-farming.model';
import { Repository } from '../repositories';

import { UserService } from './user.service';

@Injectable()
export class ContentServiceV2 {
  constructor(
    @InjectModel('Engagement')
    private _engagementModel: Model<Engagement>,
    private notificationServiceV2: NotificationServiceV2,
    private userService: UserService,
    private taccountService: TAccountService,
    private repository: Repository,
    @InjectModel('ContentFarming')
    private contentFarmingModel: Model<ContentFarming>,
    @InjectModel('Content')
    private contentModel: Model<Content>
  ) {}

  likeCast = async (content: Content, user: User, account: Account) => {
    const engagement = await this._engagementModel.findOne({
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
      type: EngagementType.Like,
    });
    if (engagement) throw CastcleException.LIKE_IS_EXIST;

    await new this._engagementModel({
      type: EngagementType.Like,
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: content._id,
      },
      visibility: EntityVisibility.Publish,
    }).save();

    if (String(user._id) === String(content.author.id)) return;

    const userOwner = await this.userService.getByIdOrCastcleId(
      content.author.id
    );
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
  };
  unlikeCast = async (contentId: string, user: User) => {
    const engagement = await this._engagementModel.findOne({
      user: user._id,
      targetRef: {
        $ref: 'content',
        $id: Types.ObjectId(contentId),
      },
      type: EngagementType.Like,
    });

    if (!engagement) return;

    if (String(engagement.user) !== String(user._id)) return;

    return engagement.remove();
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

  getLikingCast = async (
    contentId: string,
    account: Account,
    query: PaginationQuery,
    viewer?: User
  ) => {
    const filter = {
      contentId,
      type: EngagementType.Like,
    };
    const likingCounts = await this.repository.findEngagementCount(filter);

    const likingDocuments = await this.repository.findEngagement(
      { ...query, ...filter },
      {
        limit: query.maxResults,
        sort: { createdAt: -1 },
        populate: 'user',
      }
    );

    if (!likingDocuments.length)
      return {
        items: [],
        count: 0,
      };

    if (!query.hasRelationshipExpansion || account.isGuest) {
      const likingResponse = await Promise.all(
        likingDocuments.map(async (engagement) => {
          return engagement.user.type === UserType.PAGE
            ? engagement.user.toPageResponseV2()
            : await engagement.user.toUserResponseV2();
        })
      );
      return {
        items: likingResponse,
        count: likingCounts,
      };
    }
    const relationshipUser = likingDocuments.map((item) => item.user._id);

    const relationships = await this.repository.findRelationships({
      userId: relationshipUser,
    });
    const relationship = relationships?.find(
      (relationship) => String(relationship.user) === String(viewer?._id)
    );

    const likingResponse = await Promise.all(
      likingDocuments.map(async (engagement) => {
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
      items: likingResponse,
      count: likingCounts,
    };
  };
}
