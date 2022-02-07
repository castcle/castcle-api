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
import { Model } from 'mongoose';
import {
  pipelineOfGetEligibleAccountsFromCampaign,
  EligibleAccount,
} from '../aggregations';
import {
  CampaignStatus,
  CampaignType,
  ClaimAirdropPayload,
  QueueStatus,
  QueueTopic,
} from '../models';
import { WalletType } from '../models/wallet.enum';
import { Account, Campaign, Queue, Transaction } from '../schemas';

@Injectable()
export class CampaignService {
  private fractionDigits = 8;
  private round = (n: number) => n.toFixed(this.fractionDigits);
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
    const campaignQuery = {
      type: CampaignType.CONTENT_REACH,
      status: CampaignStatus.CALCULATING,
      endDate: { $lte: new Date() },
    };

    const campaign = await this.campaignModel.findOne(campaignQuery);

    if (!campaign) {
      return this.logger.log(`#claimContentReachAirdrops:completed`);
    }

    if (campaign.rewardBalance > 0) {
      const eligibleAccounts =
        await this.campaignModel.aggregate<EligibleAccount>(
          pipelineOfGetEligibleAccountsFromCampaign(campaignQuery)
        );

      eligibleAccounts.forEach(async ({ id, campaignId, amount }) => {
        const queue = await new this.queueModel({
          payload: new ClaimAirdropPayload(id, campaignId, amount),
        }).save();

        await this.campaignQueue.add(queue);
        this.logger.log(
          `#claimContentReachAirdrops:submit:queueId-${queue.id}
  Claim campaign's airdrop: ${campaignId}
  For account: ${id}`
        );
      });
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

    const queues = await this.queueModel.find({
      status: { $ne: QueueStatus.FAILED },
      'payload.accountId': accountId,
      'payload.campaignId': campaign.id,
      'payload.topic': QueueTopic.CLAIM_AIRDROP,
    });

    const claimsCount = queues.length;
    const hasReachedMaxClaims = claimsCount >= campaign.maxClaims;

    this.logger.log(
      `#claimCampaignsAirdrop:init
Claim campaign's airdrop: ${campaign.name} [${campaign.id}]
For account: ${accountId}
Reached max limit: ${hasReachedMaxClaims} [${claimsCount}/${campaign.maxClaims}]`
    );

    if (hasReachedMaxClaims) throw CastcleException.REACHED_MAX_CLAIMS;

    const queue = await new this.queueModel({
      payload: new ClaimAirdropPayload(accountId, campaign.id),
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
        job.data
      )}`
    );

    const queue = await this.queueModel.findById(job.data._id);

    try {
      queue.startedAt = new Date();
      const payload = queue.payload;
      const campaign = await this.campaignModel.findById(payload.campaignId);
      const account = await this.accountModel
        .findById(payload.accountId)
        .select('+campaigns');

      switch (campaign.type) {
        case CampaignType.FRIEND_REFERRAL:
        case CampaignType.VERIFY_MOBILE:
          await this.isEligibleForVerifyMobileCampaign(account, campaign);
      }

      await this.claimAirdrop(account, campaign, payload);

      queue.status = QueueStatus.DONE;

      this.logger.log(
        `#processClaimAirdropJob:done:jobId-${job.id}\n${JSON.stringify(
          job.data
        )}`
      );
    } catch (error: unknown) {
      this.logger.error(
        `#processClaimAirdropJob:error:jobId-${job.id}\n${JSON.stringify(
          job.data
        )}`,
        error instanceof Error ? error.stack : JSON.stringify(error)
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
    const isRewardEnough = this.round(
      campaign.rewardBalance - campaign.rewardsPerClaim
    );

    if (!isRewardEnough) throw CastcleException.REWARD_IS_NOT_ENOUGH;

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
    account: Account,
    campaign: Campaign,
    claimCampaignsAirdropJob: ClaimAirdropPayload
  ) {
    claimCampaignsAirdropJob.amount =
      campaign.rewardBalance >= claimCampaignsAirdropJob.amount
        ? claimCampaignsAirdropJob.amount
        : campaign.rewardBalance;

    const amount = campaign.rewardsPerClaim ?? claimCampaignsAirdropJob.amount;
    const transaction = await new this.transactionModel({
      to: { account: account.id, type: WalletType.PERSONAL },
      value: amount,
      data: JSON.stringify(claimCampaignsAirdropJob),
    }).save();

    if (!account.campaigns) account.campaigns = {};
    if (!account.campaigns[campaign.id]) account.campaigns[campaign.id] = [];

    account.campaigns[campaign.id].push(new Date());

    await account.save();
    await campaign
      .set({
        rewardBalance: this.round(campaign.rewardBalance - amount),
      })
      .save();

    this.logger.log(
      `#claimAirdrop:transaction-created:${transaction.id}
Claim campaign's airdrop: ${campaign.name} [${campaign.id}]
For account: ${account.id}
Amount: ${amount}`
    );

    return transaction;
  }
}
