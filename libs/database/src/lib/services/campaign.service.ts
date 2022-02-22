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

import { CastLogger } from '@castcle-api/logger';
import { CastcleException } from '@castcle-api/utils/exception';
import { TopicName } from '@castcle-api/utils/queue';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job, Queue as BullQueue } from 'bull';
import { ClientSession, FilterQuery, Model } from 'mongoose';
import {
  pipelineOfGetEligibleAccountsFromCampaign,
  EligibleAccount,
  pipelineOfGetCampaignClaims,
  GetCampaignClaimsResponse,
} from '../aggregations';
import {
  CampaignStatus,
  CampaignType,
  CastcleNumber,
  ClaimAirdropPayload,
  QueueStatus,
  QueueTopic,
} from '../models';
import { WalletType } from '../models/wallet.enum';
import { Account, Campaign, Queue, Transaction } from '../schemas';

@Injectable()
export class CampaignService {
  private logger = new CastLogger(CampaignService.name);

  constructor(
    @InjectModel('Account')
    private accountModel: Model<Account>,
    @InjectModel('Campaign')
    private campaignModel: Model<Campaign>,
    @InjectModel('Transaction')
    private transactionModel: Model<Transaction>,
    @InjectModel('Queue')
    private queueModel: Model<Queue<ClaimAirdropPayload>>,
    @InjectQueue(TopicName.Campaigns)
    private campaignQueue: BullQueue<Queue<ClaimAirdropPayload>>
  ) {}

  /**
   * Get remaining queues and convert into BullQueues
   * @param queueTopic available values: 'claim-airdrop'
   */
  async getRemainingQueues(queueTopic: QueueTopic) {
    const queues = await this.queueModel.find({
      status: QueueStatus.WAITING,
      'payload.topic': queueTopic,
    });

    return queues.map((queue) => ({ data: queue }));
  }

  async claimContentReachAirdrops() {
    const campaign = await this.campaignModel.findOne({
      type: CampaignType.CONTENT_REACH,
      status: CampaignStatus.CALCULATING,
      endDate: { $lte: new Date() },
    });

    if (!campaign) {
      return this.logger.log(`#claimContentReachAirdrops:completed`);
    }

    if (campaign.rewardBalance > 0) {
      const eligibleAccounts =
        await this.campaignModel.aggregate<EligibleAccount>(
          pipelineOfGetEligibleAccountsFromCampaign(campaign)
        );

      const to = eligibleAccounts.map(({ id, amount }) => {
        return {
          account: id,
          type: WalletType.PERSONAL,
          value: CastcleNumber.from(amount).toNumber(),
        };
      });

      const queue = await new this.queueModel({
        payload: new ClaimAirdropPayload(campaign.id, to),
      }).save();

      await this.campaignQueue.add(queue);
      this.logger.log(
        `#claimContentReachAirdrops:submit:queueId-${queue.id}
  Claim campaign's airdrop: ${campaign.id}
  For: ${JSON.stringify(queue, null, 2)}`
      );
    }

    await campaign.set({ status: CampaignStatus.COMPLETE }).save();

    this.logger.log(
      `#claimContentReachAirdrops - campaignId: ${campaign.id} updated`
    );

    await this.claimContentReachAirdrops();
  }

  async claimCampaignsAirdrop(accountId: string, campaignType: CampaignType) {
    const now = new Date();
    const campaign = await this.campaignModel.findOne({
      type: campaignType,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    if (!campaign) throw CastcleException.CAMPAIGN_HAS_NOT_STARTED;
    if (campaign.rewardBalance < campaign.rewardsPerClaim) {
      throw CastcleException.REWARD_IS_NOT_ENOUGH;
    }

    const claims = await this.queueModel.aggregate([
      { $unwind: { path: '$payload.to' } },
      {
        $match: {
          status: { $ne: QueueStatus.FAILED },
          'payload.to.account': accountId,
          'payload.campaignId': campaign.id,
          'payload.topic': QueueTopic.CLAIM_AIRDROP,
        },
      },
      { $count: 'count' },
    ]);

    const claimsCount = claims[0]?.count;
    const hasReachedMaxClaims = claimsCount >= campaign.maxClaims;

    this.logger.log(
      `#claimCampaignsAirdrop:init
Claim campaign's airdrop: ${campaign.name} [${campaign.id}]
For account: ${accountId}
Reached max limit: ${hasReachedMaxClaims} [${claimsCount}/${campaign.maxClaims}]`
    );

    if (hasReachedMaxClaims) throw CastcleException.REACHED_MAX_CLAIMS;

    const account = await this.accountModel.findById(accountId);

    if (campaignType === CampaignType.VERIFY_MOBILE) {
      const claimedMobileNumber = await this.queueModel.count({
        'payload.mobile': account?.mobile,
      });

      if (claimedMobileNumber) throw CastcleException.NOT_ELIGIBLE_FOR_CAMPAIGN;
    }

    const queue = await new this.queueModel({
      payload: new ClaimAirdropPayload(
        campaign.id,
        [{ account: accountId, type: WalletType.PERSONAL }],
        account?.mobile
      ),
    }).save();

    await this.campaignQueue.add(queue);

    this.logger.log(
      `#claimCampaignAirdrops:submit:queueId-${queue.id}
Claim campaign's airdrop: ${campaign.name} [${campaign.id}]
For account: ${accountId}`
    );
  }

  async processClaimAirdrop(job: Job<Queue<ClaimAirdropPayload>>) {
    this.logger.log(
      `#processClaimAirdropJob:init:jobId-${job.id}\n${JSON.stringify(
        job.data,
        null,
        2
      )}`
    );

    const session = await this.transactionModel.startSession();
    const queue = await this.queueModel.findById(job.data._id);

    try {
      session.startTransaction();
      queue.startedAt = new Date();
      const payload = queue.payload;
      const campaign = await this.campaignModel.findById(payload.campaignId);

      payload.to.forEach(async ({ account: accountId }) => {
        const account = await this.accountModel
          .findById(accountId)
          .select('+campaigns');

        if (!account) return;

        switch (campaign.type) {
          case CampaignType.FRIEND_REFERRAL:
          case CampaignType.VERIFY_MOBILE:
            await this.isEligibleForVerifyMobileCampaign(account, campaign);
        }

        if (!account.campaigns) account.campaigns = {};
        if (!account.campaigns[campaign.id]) {
          account.campaigns[campaign.id] = [];
        }

        account.campaigns[campaign.id].push(new Date());
        await account.save({ session });
      });

      await this.claimAirdrop(campaign, payload, session);
      await session.commitTransaction();

      queue.status = QueueStatus.DONE;

      this.logger.log(
        `#processClaimAirdropJob:done:jobId-${job.id}\n${JSON.stringify(
          job.data,
          null,
          2
        )}`
      );
    } catch (error: unknown) {
      await session.abortTransaction();

      this.logger.error(
        `#processClaimAirdropJob:error:jobId-${job.id}\n${JSON.stringify(
          job.data,
          null,
          2
        )}`,
        error instanceof Error ? error.stack : JSON.stringify(error, null, 2)
      );

      queue.status = QueueStatus.FAILED;
    } finally {
      await queue.set({ endedAt: new Date() }).save();
    }
  }

  private async isEligibleForVerifyMobileCampaign(
    account: Account,
    campaign: Campaign
  ) {
    if (campaign.rewardBalance < campaign.rewardsPerClaim) {
      throw CastcleException.REWARD_IS_NOT_ENOUGH;
    }

    const claimsCount = account.campaigns?.[campaign.id]?.length ?? 0;
    const hasReachedMaxClaims = claimsCount > campaign.maxClaims;

    this.logger.log(
      `#isEligibleForVerifyMobileCampaign:done
Claim campaign's airdrop: ${campaign.name} [${campaign.id}]
For account: ${account.id}
Reached max limit: ${hasReachedMaxClaims} [${claimsCount}/${campaign.maxClaims}]`
    );

    if (hasReachedMaxClaims) throw CastcleException.REACHED_MAX_CLAIMS;
  }

  private async claimAirdrop(
    campaign: Campaign,
    claimCampaignsAirdropJob: ClaimAirdropPayload,
    session: ClientSession
  ) {
    let sumAmount = 0;
    const to = claimCampaignsAirdropJob.to.map(({ account, type, value }) => {
      const remaining =
        campaign.rewardBalance >= value ? value : campaign.rewardBalance;

      const amount = campaign.rewardsPerClaim ?? remaining;
      sumAmount += amount;
      campaign.rewardBalance = CastcleNumber.from(
        campaign.rewardBalance - amount
      ).toNumber();

      return { account, type, value: amount };
    });

    const from = { type: WalletType.CASTCLE_AIRDROP, value: sumAmount };
    const transaction = await new this.transactionModel({
      from,
      to,
      data: { campaignId: claimCampaignsAirdropJob.campaignId },
    }).save({ session });

    await campaign.save({ session });

    this.logger.log(
      `#claimAirdrop:transaction-created:${transaction.id}
Claim campaign's airdrop: ${campaign.name} [${campaign.id}]
${JSON.stringify(transaction, null, 2)}`
    );

    return transaction;
  }

  async getAirdropBalances(accountId: string, dateRange: Date) {
    const campaignQuery: FilterQuery<Campaign> = dateRange
      ? {
          startDate: { $lte: dateRange },
          endDate: { $gte: dateRange },
        }
      : {};

    const campaigns =
      await this.campaignModel.aggregate<GetCampaignClaimsResponse>(
        pipelineOfGetCampaignClaims(campaignQuery, accountId)
      );

    const contentReachCampaign = campaigns.find(
      ({ type }) => type === CampaignType.CONTENT_REACH
    );

    const a = pipelineOfGetEligibleAccountsFromCampaign(contentReachCampaign);
    console.log(JSON.stringify(a, null, 2));

    const eligibleAccounts =
      await this.campaignModel.aggregate<EligibleAccount>(
        pipelineOfGetEligibleAccountsFromCampaign(contentReachCampaign)
      );

    console.log(JSON.stringify(eligibleAccounts, null, 2));

    return campaigns.map((campaign) => {
      const eligibleAccount = eligibleAccounts.find(
        (eligibleAccount) =>
          String(eligibleAccount.campaignId) === String(campaign._id) &&
          String(eligibleAccount.id) === String(accountId)
      );

      return {
        ...campaign,
        estimateRewards: CastcleNumber.from(eligibleAccount?.amount).toNumber(),
      };
    });
  }
}
