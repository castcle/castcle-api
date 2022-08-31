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
  Campaign,
  CampaignStatus,
  CampaignType,
  EntityVisibility,
  FeedItemV2,
  QueueName,
  Transaction,
  TransactionType,
  WalletType,
} from '@castcle-api/database';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bull';
import { Model } from 'mongoose';
import {
  EligibleAccounts,
  pipelineOfEstimateContentReach,
} from './aggregation';

@Injectable()
export class ContentReachScheduler {
  private logger = new CastcleLogger(ContentReachScheduler.name);

  constructor(
    @InjectModel('Campaign') private campaignModel: Model<Campaign>,
    @InjectModel('FeedItemV2') private feedModel: Model<FeedItemV2>,
    @InjectModel('Transaction') private transactionModel: Model<Transaction>,
    @InjectQueue(QueueName.NEW_TRANSACTION) private txQueue: Queue<Transaction>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handle() {
    const campaigns = await this.campaignModel.find({
      type: CampaignType.CONTENT_REACH,
      status: { $ne: CampaignStatus.COMPLETED },
      startDate: { $lte: new Date() },
      endDate: { $lte: new Date() },
      visibility: EntityVisibility.Publish,
    });

    for (const campaign of campaigns) {
      try {
        await this.claimContentReachAirdrop(campaign);
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  private async claimContentReachAirdrop(campaign: Campaign) {
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

    return this.txQueue.add(transaction, { removeOnComplete: true });
  }
}
