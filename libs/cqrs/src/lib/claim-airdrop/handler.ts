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
  CampaignStatus,
  CampaignType,
  EntityVisibility,
  FeedItem,
  QueueName,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  UserType,
  WalletType,
} from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import {
  EligibleAccounts,
  pipelineOfDistributeCampaignReward,
  pipelineOfEstimateContentReach,
} from './aggregation';
import { ClaimAirdropCommand } from './command';

@CommandHandler(ClaimAirdropCommand)
export class ClaimAirdropHandler
  implements ICommandHandler<ClaimAirdropCommand>
{
  constructor(
    @InjectModel('Campaign') private campaignModel: Model<Campaign>,
    @InjectModel('FeedItem') private feedModel: Model<FeedItem>,
    @InjectModel('Transaction') private transactionModel: Model<Transaction>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectQueue(QueueName.NEW_TRANSACTION)
    private verifier: Queue<Transaction>,
  ) {}

  async execute(command: ClaimAirdropCommand) {
    const [campaign, claimsCount] = await Promise.all([
      command.campaign instanceof Campaign
        ? command.campaign
        : this.campaignModel.findById(command.campaign),
      !command.user
        ? 0
        : this.transactionModel.count({
            type: TransactionType.AIRDROP,
            status: { $ne: TransactionStatus.FAILED },
            'to.user': command.user._id,
            'data.campaign': new Types.ObjectId(command.campaign._id),
          }),
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

    switch (campaign.type) {
      case CampaignType.CONTENT_REACH:
        return this.claimContentReachAirdrop(campaign);
      case CampaignType.FRIEND_REFERRAL:
        return this.claimFriendReferralAirdrop(campaign, command.user);
      case CampaignType.VERIFY_MOBILE:
        return this.claimVerifyMobileAirdrop(campaign, command.user);
    }
  }

  private async claimContentReachAirdrop(campaign: Campaign) {
    const hasCampaignCompleted = campaign.status === CampaignStatus.COMPLETED;
    const hasCampaignEnded = new Date() > campaign.endDate;
    if (hasCampaignCompleted || !hasCampaignEnded) {
      throw new CastcleException('CAMPAIGN_NOT_FOUND');
    }

    const [eligibleAccounts] = await this.feedModel.aggregate<EligibleAccounts>(
      pipelineOfEstimateContentReach(campaign),
    );

    if (!eligibleAccounts.to.length) {
      return campaign.updateOne({ $set: { status: CampaignStatus.COMPLETED } });
    }

    const [transaction] = await Promise.all([
      new this.transactionModel({
        from: {
          type: WalletType.CASTCLE_AIRDROP,
          value: campaign.rewardBalance,
        },
        to: eligibleAccounts.to,
        type: TransactionType.AIRDROP,
        data: { campaign: campaign._id },
      }).save(),
      campaign.updateOne({
        $set: { rewardBalance: 0, status: CampaignStatus.COMPLETED },
      }),
    ]);

    return this.verifier.add(transaction, { removeOnComplete: true });
  }

  private async claimFriendReferralAirdrop(
    campaign: Campaign,
    userDto: Types.ObjectId | User | undefined,
  ) {
    const now = new Date();
    const hasCampaignStarted = now > campaign.startDate;
    const hasCampaignEnded = now > campaign.endDate;
    if (hasCampaignStarted || !hasCampaignEnded) {
      throw new CastcleException('CAMPAIGN_HAS_NOT_STARTED');
    }
    if (Number(campaign.rewardBalance) < Number(campaign.rewardsPerClaim)) {
      throw new CastcleException('REWARD_IS_NOT_ENOUGH');
    }

    const user = userDto
      ? await this.userModel.findById(userDto._id).populate('ownerAccount')
      : null;

    if (user?.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
    }

    const transaction = new this.transactionModel({
      type: TransactionType.AIRDROP,
      from: {
        type: WalletType.CASTCLE_AIRDROP,
        value: campaign.rewardsPerClaim,
      },
      to: [
        { user, type: WalletType.PERSONAL, value: campaign.rewardsPerClaim },
      ],
      data: { campaign: campaign._id },
    });

    const rewardsToReferredUser = Number(campaign.rewardsPerClaim);
    const rewardsToReferrer = Number(campaign.rewardsPerClaim);
    const referralRewards = rewardsToReferredUser + rewardsToReferrer;
    const isRewardEnough = Number(campaign.rewardBalance) < referralRewards;
    if (!isRewardEnough || !user.ownerAccount.referralBy) {
      return Promise.all([
        campaign.updateOne(pipelineOfDistributeCampaignReward()).exec(),
        transaction.save(),
      ]);
    }

    const referrer = await this.userModel.findOne({
      ownerAccount: user.ownerAccount.referralBy as any,
      type: UserType.PEOPLE,
      visibility: EntityVisibility.Publish,
    });

    await Promise.all(
      !referrer
        ? [
            transaction.save(),
            campaign.updateOne(pipelineOfDistributeCampaignReward()).exec(),
          ]
        : [
            transaction.updateOne(
              [
                {
                  $set: {
                    'from.value': { $multiply: ['$from.value', 2] },
                    to: {
                      $concatArrays: [
                        '$to',
                        {
                          user: referrer._id,
                          type: WalletType.PERSONAL,
                          value: campaign.rewardsPerClaim,
                        },
                      ],
                    },
                  },
                },
              ],
              { upsert: true },
            ),
            campaign.updateOne(pipelineOfDistributeCampaignReward(2)).exec(),
          ],
    );

    return this.verifier.add(transaction, { removeOnComplete: true });
  }

  private async claimVerifyMobileAirdrop(
    campaign: Campaign,
    userDto: Types.ObjectId | User | undefined,
  ) {
    const now = new Date();
    const hasCampaignStarted = now > campaign.startDate;
    const hasCampaignEnded = now > campaign.endDate;
    if (hasCampaignStarted || !hasCampaignEnded) {
      throw new CastcleException('CAMPAIGN_HAS_NOT_STARTED');
    }
    if (Number(campaign.rewardBalance) < Number(campaign.rewardsPerClaim)) {
      throw new CastcleException('REWARD_IS_NOT_ENOUGH');
    }

    const user = userDto
      ? await this.userModel.findById(userDto._id).populate('ownerAccount')
      : null;

    if (user?.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
    }

    const isClaimedMobileNumber = await this.transactionModel.findOne({
      type: TransactionType.AIRDROP,
      status: { $ne: TransactionStatus.FAILED },
      'data.mobileCountryCode': user.ownerAccount.mobile.countryCode,
      'data.mobileNumber': user.ownerAccount.mobile.number,
    });
    if (isClaimedMobileNumber) {
      throw new CastcleException('NOT_ELIGIBLE_FOR_CAMPAIGN');
    }

    const [transaction] = await Promise.all([
      new this.transactionModel({
        type: TransactionType.AIRDROP,
        from: {
          type: WalletType.CASTCLE_AIRDROP,
          value: campaign.rewardsPerClaim,
        },
        to: [
          {
            user,
            type: WalletType.PERSONAL,
            value: campaign.rewardsPerClaim,
          },
        ],
        data: {
          campaign: campaign._id,
          mobileCountryCode: user.ownerAccount.mobile.countryCode,
          mobileNumber: user.ownerAccount.mobile.number,
        },
      }).save(),
      campaign.updateOne(pipelineOfDistributeCampaignReward()).exec(),
    ]);

    return this.verifier.add(transaction, { removeOnComplete: true });
  }
}
