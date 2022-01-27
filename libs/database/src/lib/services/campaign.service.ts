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
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CampaignType, ClaimAirdropPayload } from '../models';
import { Account, Campaign, Queue, User } from '../schemas';

@Injectable()
export class CampaignService {
  private logger = new CastLogger(CampaignService.name);

  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('Campaign') private campaignModel: Model<Campaign>,
    @InjectModel('Queue')
    private queueModel: Model<Queue<ClaimAirdropPayload>>
  ) {}

  /**
   * @param {CampaignType} type Available values: `content-reach`, `friend-referral` or `verify-mobile`
   * @returns Active campaign which `startDate <= now <= endDate`
   */
  async getActiveCampaign(type: CampaignType) {
    const now = new Date();

    return this.campaignModel.findOne({
      type,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
  }

  async claimCampaignsAirdrop(
    accountId: string,
    user: User,
    campaignType: CampaignType
  ) {
    const campaign = await this.getActiveCampaign(campaignType);

    if (!campaign) throw CastcleException.CAMPAIGN_HAS_NOT_STARTED;

    switch (campaign.type) {
      case CampaignType.VERIFY_MOBILE: {
        if (!user.verified.mobile) {
          throw CastcleException.NOT_ELIGIBLE_FOR_CAMPAIGN;
        }
      }
    }

    const account = await this.accountModel
      .findById(accountId)
      .select('+campaigns');

    const claimAirdropPayload = new ClaimAirdropPayload(
      account.id,
      campaign.id
    );

    const queues = await this.queueModel.find({
      'payload.accountId': claimAirdropPayload.accountId,
      'payload.campaignId': claimAirdropPayload.campaignId,
      'payload.topic': claimAirdropPayload.topic,
    });

    const claimsCount = queues.length;
    const hasReachedMaxClaims = claimsCount >= campaign.maxClaims;

    this.logger.log(
      `#claimCampaignsAirdrop:init
Claim campaign's airdrop: ${campaign.name} [${campaign.id}]
For account: ${account.id}
Reached max limit: ${hasReachedMaxClaims} [${claimsCount}/${campaign.maxClaims}]`
    );

    if (hasReachedMaxClaims) throw CastcleException.REACHED_MAX_CLAIMS;

    const queue = await new this.queueModel({
      payload: claimAirdropPayload,
    }).save();

    this.logger.log(
      `#claimCampaignsAirdrop:submit:queueId-${queue.id}
Claim campaign's airdrop: ${campaign.name} [${campaign.id}]
For account: ${account.id}`
    );
  }
}
