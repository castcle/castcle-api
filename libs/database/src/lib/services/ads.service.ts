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
import { FilterQuery, Model } from 'mongoose';
import { mockPipe2AdsAuctionAggregate } from '../aggregations/ads.aggregation';
import { AdsCampaignResponseDto, AdsRequestDto } from '../dtos/ads.dto';
import {
  Account,
  AdsCampaign,
  AdsPlacement,
  Content,
  toSignedContentPayloadItem,
  User,
} from '../schemas';
import * as mongoose from 'mongoose';
import { AdsDetail } from '../schemas/ads-detail.schema';
import { AdsBoostStatus, AdsStatus, DefaultAdsStatistic } from '../models';
import {
  ContentPayloadItem,
  DEFAULT_QUERY_OPTIONS,
  PageResponseDto,
  PaginationQuery,
} from '../dtos';
import { createCastcleFilter } from '../utils/common';

const CAST_PRICE = 0.1;

@Injectable()
export class AdsService {
  constructor(
    @InjectModel('AdsCampaign')
    public _adsCampaignModel: Model<AdsCampaign>,
    @InjectModel('AdsPlacement') public _adsPlacementModel: Model<AdsPlacement>,
    @InjectModel('Content')
    public _contentModel: Model<Content>,
    @InjectModel('User')
    public _userModel: Model<User>
  ) {}

  getAdsPlacementFromAuction = async (
    contentIds: string[],
    viewer: Account
  ) => {
    const aggrResult = mockPipe2AdsAuctionAggregate();

    const adsPlacement = new this._adsPlacementModel({
      campaign: aggrResult.campaign,
      contents: contentIds,
      cost: {
        CAST: aggrResult.auctionPrice / CAST_PRICE,
        USDC: aggrResult.auctionPrice,
      },
      viewer: viewer._id,
    });
    return adsPlacement.save();
  };

  getCode = (account: Account) =>
    `${String(account._id).toUpperCase().slice(19)}${new Date().getTime()}`;

  /**
   * Create a ads campaign
   * @param account
   * @param adsRequest
   * @returns {AdsCampaign}
   */
  createAds = async (account: Account, adsRequest: AdsRequestDto) => {
    const adsRef = adsRequest.userId
      ? {
          $ref: 'user',
          $id: new mongoose.Types.ObjectId(adsRequest.userId),
        }
      : {
          $ref: 'content',
          $id: new mongoose.Types.ObjectId(adsRequest.contentId),
        };
    console.log(adsRef);
    //TODO !!! have to validate if account have enough balance
    const campaign = new this._adsCampaignModel({
      adsRef: adsRef,
      owner: account._id,
      objective: adsRequest.objective,
      detail: {
        name: adsRequest.campaignName,
        message: adsRequest.campaignMessage,
        code: this.getCode(account), //TODO !!! have to change according to biz logic for example ADSPAGE00001  = 1 ads that promote page or it have to linked with owner account from the code
        dailyBudget: adsRequest.dailyBudget,
        duration: adsRequest.duration,
      } as AdsDetail,
      statistics: DefaultAdsStatistic,
      status: AdsStatus.Processing,
      boostStatus: AdsBoostStatus.Unknown,
    });
    return campaign.save();
  };

  transformAdsCampaignToAdsResponse = async (campaign: AdsCampaign) => {
    let payload: ContentPayloadItem | PageResponseDto; // = {};
    if (campaign.adsRef.$ref === 'user' || campaign.adsRef.oref === 'user') {
      const page = await this._userModel.findById(
        campaign.adsRef.$id || campaign.adsRef.oid
      );
      payload = page.toPageResponse();
    } else {
      const content = await this._contentModel.findById(
        campaign.adsRef.$id || campaign.adsRef.oid
      );
      payload = toSignedContentPayloadItem(content);
    }
    return {
      campaignName: campaign.detail.name,
      campaignMessage: campaign.detail.message,
      adStatus: campaign.status,
      boostStatus: campaign.boostStatus,
      boostType:
        campaign.adsRef.$ref === 'user' || campaign.adsRef.oref
          ? 'page'
          : 'content',
      campaignCode: campaign.detail.code,
      dailyBudget: campaign.detail.dailyBudget,
      duration: campaign.detail.duration,
      objective: campaign.objective,
      payload: payload,
      engagement: campaign.statistics.engagements, // this could use,
      statistics: {
        CPM: campaign.statistics.cpm,
        budgetSpent: campaign.statistics.budgetSpent,
        dailySpent: campaign.statistics.dailySpent,
        impression: {
          organic: 0, // need to embed organic stat to content,
          paid: 0,
        },
        reach: {
          organic: 0,
          paid: 0,
        },
      },
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    } as AdsCampaignResponseDto;
  };

  async getListAds(
    { _id }: Account,
    {
      sinceId,
      untilId,
      maxResults = DEFAULT_QUERY_OPTIONS.limit,
    }: PaginationQuery
  ) {
    const filter: FilterQuery<AdsCampaign> = createCastcleFilter(
      { owner: _id },
      {
        sinceId,
        untilId,
      }
    );
    return this._adsCampaignModel
      .find(filter)
      .limit(maxResults)
      .sort({ createdAt: -1, _id: -1 });
  }

  lookupAds({ _id }: Account, adsId: string) {
    return this._adsCampaignModel
      .findOne({
        owner: _id,
        _id: adsId,
      })
      .exec();
  }
}
