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

import {
  Campaign,
  CampaignType,
  EntityVisibility,
  QueueName,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  WalletType,
} from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';

@Injectable()
export class AirdropService {
  constructor(
    @InjectModel('Campaign') private campaignModel: Model<Campaign>,
    @InjectModel('Transaction') private transactionModel: Model<Transaction>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectQueue(QueueName.NEW_TRANSACTION)
    private verifier: Queue<Transaction>,
  ) {}

  async claimOtherAirdrop(campaignId: string, userId: string) {
    const [campaign, claimsCount, user] = await Promise.all([
      this.campaignModel.findOne({
        _id: campaignId,
        type: {
          $ne: [
            CampaignType.CONTENT_REACH,
            CampaignType.FRIEND_REFERRAL,
            CampaignType.VERIFY_MOBILE,
          ],
        },
      }),
      this.transactionModel.count({
        type: TransactionType.AIRDROP,
        status: { $ne: TransactionStatus.FAILED },
        'to.user': userId,
        'data.campaign': new Types.ObjectId(campaignId),
      }),
      this.userModel.findById(userId),
    ]);

    if (campaign?.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('CAMPAIGN_NOT_FOUND');
    }
    if (!Number(campaign.rewardBalance)) {
      throw new CastcleException('REWARD_IS_NOT_ENOUGH');
    }
    if (campaign.maxClaims && claimsCount >= campaign.maxClaims) {
      throw new CastcleException('REACHED_MAX_CLAIMS');
    }
    if (new Date() < campaign.startDate || new Date() > campaign.endDate) {
      throw new CastcleException('CAMPAIGN_HAS_NOT_STARTED');
    }
    if (Number(campaign.rewardBalance) < Number(campaign.rewardsPerClaim)) {
      throw new CastcleException('REWARD_IS_NOT_ENOUGH');
    }
    if (user?.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
    }

    const [transaction] = await Promise.all([
      new this.transactionModel({
        type: TransactionType.AIRDROP,
        from: {
          type: WalletType.CASTCLE_AIRDROP,
          value: campaign.rewardsPerClaim,
        },
        to: [
          { user, type: WalletType.PERSONAL, value: campaign.rewardsPerClaim },
        ],
        data: { campaign: campaign._id },
      }).save(),
      campaign.updateOne([
        {
          $set: {
            rewardBalance: {
              $subtract: [
                { $toDecimal: '$rewardBalance' },
                { $toDecimal: '$rewardsPerClaim' },
              ],
            },
          },
        },
      ]),
    ]);

    return this.verifier.add(transaction, { removeOnComplete: true });
  }
}
