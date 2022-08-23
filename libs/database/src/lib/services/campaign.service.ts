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
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  EligibleAccount,
  GetCampaignClaimsResponse,
  pipelineOfEstimateContentReach,
  pipelineOfGetCampaignClaims,
} from '../aggregations';
import { CampaignField } from '../dtos';
import {
  CampaignStatus,
  CampaignType,
  ClaimAirdropPayload,
  QueueStatus,
  QueueTopic,
} from '../models';
import { Campaign, FeedItem, Queue } from '../schemas';

@Injectable()
export class CampaignService {
  private logger = new CastcleLogger(CampaignService.name);

  constructor(
    @InjectModel('Campaign')
    private campaignModel: Model<Campaign>,
    @InjectModel('FeedItem')
    private feedModel: Model<FeedItem>,
    @InjectModel('Queue')
    private queueModel: Model<Queue<ClaimAirdropPayload>>,
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

  getContentReachCampaigns() {
    return this.campaignModel.find({
      type: CampaignType.CONTENT_REACH,
      status: { $ne: CampaignStatus.COMPLETED },
    });
  }

  getCampaign(type: CampaignType) {
    return this.campaignModel.findOne({
      type,
      startDate: { $gte: new Date() },
      endDate: { $lte: new Date() },
    });
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
        estimateRewards: eligibleAccount?.amount,
      };
    });

    return Promise.all($balances);
  }
}
