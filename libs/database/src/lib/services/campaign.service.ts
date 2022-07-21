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
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue as BullQueue, Job } from 'bull';
import { FilterQuery, Model } from 'mongoose';
import {
  EligibleAccount,
  GetCampaignClaimsResponse,
  pipelineOfEstimateContentReach,
  pipelineOfGetCampaignClaims,
} from '../aggregations';
import { CampaignField } from '../dtos';
import {
  CACCOUNT_NO,
  CampaignStatus,
  CampaignType,
  CastcleNumber,
  ClaimAirdropPayload,
  QueueName,
  QueueStatus,
  QueueTopic,
} from '../models';
import {
  TransactionFilter,
  TransactionType,
  WalletType,
} from '../models/wallet.enum';
import { Account, Campaign, FeedItem, Queue, TLedger } from '../schemas';
import { TAccountService } from './taccount.service';

@Injectable()
export class CampaignService {
  private logger = new CastLogger(CampaignService.name);

  constructor(
    @InjectModel('Account')
    private accountModel: Model<Account>,
    @InjectModel('Campaign')
    private campaignModel: Model<Campaign>,
    @InjectModel('FeedItem')
    private feedModel: Model<FeedItem>,
    @InjectModel('Queue')
    private queueModel: Model<Queue<ClaimAirdropPayload>>,
    @InjectQueue(QueueName.CAMPAIGN)
    private campaignQueue: BullQueue<{ queueId: string }>,
    private taccountService: TAccountService,
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

    return queues.map((queue) => ({ data: { queueId: queue.id } }));
  }

  async claimContentReachAirdrops() {
    const campaign = await this.campaignModel.findOne({
      type: CampaignType.CONTENT_REACH,
      status: CampaignStatus.CALCULATING,
      endDate: { $lte: new Date() },
    });

    if (!campaign) {
      return this.logger.log(
        JSON.stringify(campaign),
        'claimContentReachAirdrops:completed',
      );
    }

    if (campaign.rewardBalance > 0) {
      const eligibleAccounts = await this.feedModel.aggregate<EligibleAccount>(
        pipelineOfEstimateContentReach(campaign),
      );

      this.logger.log(
        JSON.stringify(eligibleAccounts),
        `getAirdropBalances:${campaign._id}`,
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

      await this.campaignQueue.add(
        { queueId: queue.id },
        {
          removeOnComplete: true,
        },
      );
      this.logger.log(
        JSON.stringify({ campaign, queue }),
        `claimContentReachAirdrops:submit:queueId-${queue.id}`,
      );
    }

    await campaign.set({ status: CampaignStatus.COMPLETE }).save();

    this.logger.log(
      `campaignId: ${campaign.id} updated`,
      `claimContentReachAirdrops`,
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

    if (!campaign) throw new CastcleException('CAMPAIGN_HAS_NOT_STARTED');
    if (campaign.rewardBalance < campaign.rewardsPerClaim) {
      throw new CastcleException('REWARD_IS_NOT_ENOUGH');
    }

    const claims = await this.queueModel.aggregate([
      { $unwind: { path: '$payload.to' } },
      {
        $match: {
          status: { $nin: [QueueStatus.CANCELLED, QueueStatus.FAILED] },
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
      JSON.stringify({
        campaignId: campaign.id,
        campaignName: campaign.name,
        accountId,
        hasReachedMaxClaims,
        reachedMaxClaims: `${claimsCount}/${campaign.maxClaims}`,
      }),
      'claimCampaignsAirdrop:init',
    );

    if (hasReachedMaxClaims) throw new CastcleException('REACHED_MAX_CLAIMS');

    const account = await this.accountModel.findById(accountId);

    if (campaignType === CampaignType.VERIFY_MOBILE) {
      const claimedMobileNumber = await this.queueModel.countDocuments({
        'payload.mobile': account?.mobile,
      });

      if (claimedMobileNumber)
        throw new CastcleException('NOT_ELIGIBLE_FOR_CAMPAIGN');
    }

    const queue = await new this.queueModel({
      payload: new ClaimAirdropPayload(
        campaign.id,
        [{ account: accountId, type: WalletType.PERSONAL }],
        account?.mobile,
      ),
    }).save();

    await this.campaignQueue.add(
      { queueId: queue.id },
      {
        removeOnComplete: true,
      },
    );

    this.logger.log(
      JSON.stringify({
        campaignId: campaign.id,
        campaignName: campaign.name,
        accountId,
        hasReachedMaxClaims,
        reachedMaxClaims: `${claimsCount}/${campaign.maxClaims}`,
      }),
      `claimCampaignAirdrops:submit:queueId-${queue.id}`,
    );
  }

  async processClaimAirdrop(job: Job<{ queueId: string }>) {
    const queue = await this.queueModel.findById(job.data.queueId);
    this.logger.log(
      JSON.stringify(queue),
      `processClaimAirdropJob:init:jobId-${job.id}`,
    );

    try {
      queue.startedAt = new Date();
      const payload = queue.payload;
      const campaign = await this.campaignModel.findById(payload.campaignId);
      const accounts = await this.accountModel
        .find({ _id: payload.to.map(({ account }) => account) })
        .select('+campaigns');

      const $accountsToSave = accounts.map(async (account) => {
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
        return account.save();
      });

      await Promise.all($accountsToSave);
      await this.claimAirdrop(campaign, payload);

      queue.status = QueueStatus.DONE;

      this.logger.log(
        JSON.stringify(queue),
        `processClaimAirdropJob:done:jobId-${job.id}`,
      );
    } catch (error: unknown) {
      this.logger.error(error, `processClaimAirdropJob:error:jobId-${job.id}`);

      queue.status = QueueStatus.FAILED;
    } finally {
      await queue.set({ endedAt: new Date() }).save();
    }
  }

  private async isEligibleForVerifyMobileCampaign(
    account: Account,
    campaign: Campaign,
  ) {
    if (campaign.rewardBalance < campaign.rewardsPerClaim) {
      throw new CastcleException('REWARD_IS_NOT_ENOUGH');
    }

    const claimsCount = account.campaigns?.[campaign.id]?.length ?? 0;
    const hasReachedMaxClaims = claimsCount > campaign.maxClaims;

    this.logger.log(
      JSON.stringify({
        campaignId: campaign.id,
        campaignName: campaign.name,
        accountId: account.id,
        hasReachedMaxClaims,
        reachedMaxClaims: `${claimsCount}/${campaign.maxClaims}`,
      }),
      'isEligibleForVerifyMobileCampaign:done',
    );

    if (hasReachedMaxClaims) throw new CastcleException('REACHED_MAX_CLAIMS');
  }

  private async claimAirdrop(
    campaign: Campaign,
    claimCampaignsAirdropJob: ClaimAirdropPayload,
  ) {
    let sumAmount = 0;
    const to = claimCampaignsAirdropJob.to.map(({ account, type, value }) => {
      const remaining =
        campaign.rewardBalance >= value ? value : campaign.rewardBalance;

      const amount = campaign.rewardsPerClaim ?? remaining;
      sumAmount += amount;
      campaign.rewardBalance = CastcleNumber.from(
        campaign.rewardBalance - amount,
      ).toNumber();

      return { account, type, value: amount };
    });
    const from = { type: WalletType.CASTCLE_AIRDROP, value: sumAmount };
    //for campaign account
    const ledgers = to.map(
      (item) =>
        ({
          debit: {
            caccountNo: CACCOUNT_NO.VAULT.AIRDROP,
            value: item.value,
          },
          credit: {
            caccountNo:
              item.type === WalletType.ADS
                ? CACCOUNT_NO.LIABILITY.USER_WALLET.ADS
                : CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
            value: item.value,
          },
        } as TLedger),
    );
    const transaction = await this.taccountService.transfer({
      from,
      to,
      data: {
        campaignId: claimCampaignsAirdropJob.campaignId,
        type: TransactionType.AIRDROP,
        filter: TransactionFilter.AIRDROP_REFERAL,
      },
      ledgers,
    });
    await campaign.save();

    this.logger.log(
      JSON.stringify({ campaign, transaction }),
      `claimAirdrop:transaction-created:${transaction.id}`,
    );

    return transaction;
  }

  async getAirdropBalances(
    accountId: string,
    dateRange: Date,
    campaignFields: CampaignField[],
  ) {
    const campaignQuery: FilterQuery<Campaign> = dateRange
      ? {
          startDate: { $lte: dateRange },
          endDate: { $gte: dateRange },
        }
      : {};

    const campaigns =
      await this.campaignModel.aggregate<GetCampaignClaimsResponse>(
        pipelineOfGetCampaignClaims(campaignQuery, accountId),
      );

    if (!campaignFields.includes(CampaignField.ESTIMATE_REWARDS)) {
      return campaigns;
    }

    const $balances = campaigns.map(async (campaign) => {
      if (campaign.type !== CampaignType.CONTENT_REACH) return campaign;

      const eligibleAccounts = await this.feedModel.aggregate<EligibleAccount>(
        pipelineOfEstimateContentReach(campaign, accountId),
      );

      this.logger.log(
        JSON.stringify(eligibleAccounts),
        `getAirdropBalances:${campaign._id}:${accountId}`,
      );

      const eligibleAccount = eligibleAccounts.find(
        (eligibleAccount) => String(eligibleAccount.id) === String(accountId),
      );

      return {
        ...campaign,
        estimateRewards: CastcleNumber.from(eligibleAccount?.amount).toNumber(),
      };
    });

    return Promise.all($balances);
  }
}
