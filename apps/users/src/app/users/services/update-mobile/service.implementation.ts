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

import { CastcleLogger } from '@castcle-api/common';
import {
  Account,
  Analytic,
  Campaign,
  CampaignType,
  EntityVisibility,
  QueueName,
  Repository,
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
import {
  UpdateMobileService,
  UpdateMobileServiceDto,
} from './service.abstract';

const { FRIEND_REFERRAL, VERIFY_MOBILE } = CampaignType;

@Injectable()
export class UpdateMobileServiceImpl implements UpdateMobileService {
  private logger = new CastcleLogger(UpdateMobileService.name);

  constructor(
    private repository: Repository,
    @InjectModel('Analytic') private analyticModel: Model<Analytic>,
    @InjectModel('Campaign') private campaignModel: Model<Campaign>,
    @InjectModel('Transaction') private transactionModel: Model<Transaction>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectQueue(QueueName.NEW_TRANSACTION) private txQueue: Queue<Transaction>,
  ) {}

  async execute({
    account,
    user,
    objective,
    refCode,
    countryCode,
    mobileNumber,
    ip,
  }: UpdateMobileServiceDto) {
    if (account.isGuest) throw new CastcleException('INVALID_ACCESS_TOKEN');

    const otp = await this.repository.findOtp({
      objective,
      receiver: countryCode + mobileNumber,
    });

    if (!otp?.isVerify) {
      throw new CastcleException('INVALID_REF_CODE');
    }
    if (!otp.isValid()) {
      await otp.updateOne({ isVerify: false, retry: 0 });
      throw new CastcleException('EXPIRED_OTP');
    }
    if (otp.refCode !== refCode) {
      await otp.failedToVerify().save();
      throw otp.exceededMaxRetries()
        ? new CastcleException('OTP_USAGE_LIMIT_EXCEEDED')
        : new CastcleException('INVALID_REF_CODE');
    }

    const isFirstTimeVerification = !user.verified.mobile;
    const hasReferral = account.referralBy;

    await Promise.all([
      user.set({ 'verified.mobile': true }).save(),
      otp.markCompleted().save(),
      account.set({ mobile: { countryCode, number: mobileNumber } }).save(),
      this.analyticModel.updateMany(
        { ip, 'registered.account': account.id },
        { mobileVerified: { countryCode, mobileNumber } },
      ),
      isFirstTimeVerification && hasReferral
        ? this.claimFriendReferralAirdrop(user, account.referralBy)
        : null,
      isFirstTimeVerification
        ? this.claimVerifyMobileAirdrop(account, user)
        : null,
    ]);
  }

  private async claimFriendReferralAirdrop(
    referredUser: User,
    referrerAccountId: Types.ObjectId,
  ) {
    const [campaign, referrerUser] = await Promise.all([
      this.campaignModel.findOne({
        type: FRIEND_REFERRAL,
        visibility: EntityVisibility.Publish,
        startDate: { $lte: new Date() },
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: new Date() } },
        ],
      }),
      this.userModel.findOne({
        ownerAccount: referrerAccountId,
        visibility: EntityVisibility.Publish,
      }),
    ]);

    if (!campaign) {
      return this.logger.log(
        `campaign not found`,
        `claimFriendReferralAirdrop:${referredUser.id}`,
      );
    }
    if (!referrerUser) {
      return this.logger.log(
        `user not found from referrer account: ${referrerAccountId.toString()}`,
        `claimFriendReferralAirdrop:${referredUser.id}`,
      );
    }

    const rewardBalance = Number(campaign.rewardBalance);
    const rewardsToReferredUser = Number(campaign.rewardsPerClaim);
    const rewardsToReferrer = Number(campaign.rewardsPerClaim);
    const rewardsToDistribute = rewardsToReferredUser + rewardsToReferrer;

    if (rewardBalance < rewardsToDistribute) {
      return this.logger.log(
        `reward is not enough, to distribute ${rewardsToDistribute} from ${rewardBalance}`,
        `claimFriendReferralAirdrop:${referredUser.id}`,
      );
    }

    const [transaction] = await Promise.all([
      new this.transactionModel({
        type: TransactionType.AIRDROP,
        data: { campaign: campaign._id },
        from: {
          type: WalletType.CASTCLE_AIRDROP,
          value: rewardsToDistribute,
        },
        to: [
          {
            user: referredUser._id,
            type: WalletType.PERSONAL,
            value: rewardsToReferredUser,
          },
          {
            user: referrerUser._id,
            type: WalletType.PERSONAL,
            value: rewardsToReferrer,
          },
        ],
      }).save(),
      campaign.updateOne(this.pipelineOfDistributeCampaignReward(2)),
    ]);

    await this.txQueue.add(transaction, { removeOnComplete: true });
  }

  private async claimVerifyMobileAirdrop(account: Account, user: User) {
    const [campaign, isClaimedMobileNumber] = await Promise.all([
      this.campaignModel.findOne({
        type: VERIFY_MOBILE,
        visibility: EntityVisibility.Publish,
        startDate: { $lte: new Date() },
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: new Date() } },
        ],
      }),
      this.transactionModel.findOne({
        type: TransactionType.AIRDROP,
        status: { $ne: TransactionStatus.FAILED },
        'data.mobileCountryCode': account.mobile.countryCode,
        'data.mobileNumber': account.mobile.number,
      }),
    ]);

    if (!campaign) {
      return this.logger.log(
        `campaign not found`,
        `claimVerifyMobileAirdrop:${user.id}`,
      );
    }
    if (isClaimedMobileNumber) {
      return this.logger.log(
        `mobile number already claimed`,
        `claimVerifyMobileAirdrop:${user.id}`,
      );
    }

    const rewardBalance = Number(campaign.rewardBalance);
    const rewardsToDistribute = Number(campaign.rewardsPerClaim);

    if (rewardBalance < rewardsToDistribute) {
      return this.logger.log(
        `reward is not enough, to distribute ${rewardsToDistribute} from ${rewardBalance}`,
        `claimVerifyMobileAirdrop:${user.id}`,
      );
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
            user: user._id,
            type: WalletType.PERSONAL,
            value: campaign.rewardsPerClaim,
          },
        ],
        data: {
          campaign: campaign._id,
          mobileCountryCode: account.mobile.countryCode,
          mobileNumber: account.mobile.number,
        },
      }).save(),
      campaign.updateOne(this.pipelineOfDistributeCampaignReward()),
    ]);

    await this.txQueue.add(transaction, { removeOnComplete: true });
  }

  private pipelineOfDistributeCampaignReward(claimCount = 1) {
    return [
      {
        $set: {
          rewardBalance: {
            $subtract: [
              { $toDecimal: '$rewardBalance' },
              { $multiply: [{ $toDecimal: '$rewardsPerClaim' }, claimCount] },
            ],
          },
        },
      },
    ];
  }
}
