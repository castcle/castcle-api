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
import { CastcleDate } from '@castcle-api/utils/commons';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  GetAdsPriceResponse,
  pipe2AdsAuctionPrice,
} from '../aggregations/ads.aggregation';
import {
  ContentPayloadItem,
  FeedItemPayloadItem,
  FeedItemResponse,
  PageResponseDto,
} from '../dtos';
import {
  AdsCampaignResponseDto,
  AdsQuery,
  AdsRequestDto,
} from '../dtos/ads.dto';
import {
  AdsBoostStatus,
  AdsPaymentMethod,
  AdsStatus,
  CACCOUNT_NO,
  DefaultAdsStatistic,
  WalletType,
} from '../models';
import {
  Account,
  AdsCampaign,
  AdsPlacement,
  Content,
  toSignedContentPayloadItem,
  User,
} from '../schemas';
import { AdsDetail } from '../schemas/ads-detail.schema';
import { createCastcleFilter } from '../utils/common';
import { FilterInterval } from './../models/ads.enum';
import { TAccountService } from './taccount.service';

/**
 * TODO
 * !!! need to use from oracle instead
 */
const mockOracleService = {
  getCastPrice: () => 0.001,
};

@Injectable()
export class AdsService {
  constructor(
    @InjectModel('AdsCampaign')
    public _adsCampaignModel: Model<AdsCampaign>,
    @InjectModel('AdsPlacement') public _adsPlacementModel: Model<AdsPlacement>,
    @InjectModel('Content')
    public _contentModel: Model<Content>,
    @InjectModel('User')
    public _userModel: Model<User>,
    public taccountService: TAccountService
  ) {}

  private logger = new CastLogger(AdsService.name);

  getAdsPlacementFromAuction = async (
    contentIds: string[],
    viewerAccountId: string
  ) => {
    const session = await this._adsPlacementModel.startSession();
    try {
      session.startTransaction();
      const price = await this._adsCampaignModel.aggregate<GetAdsPriceResponse>(
        pipe2AdsAuctionPrice()
      );
      const selectAds =
        price[0].ads[Math.floor(Math.random() * price[0].ads.length)];
      const adsPlacement = new this._adsPlacementModel({
        campaign: selectAds,
        contents: contentIds,
        cost: {
          UST: price[0].price,
        },
        viewer: mongoose.Types.ObjectId(viewerAccountId),
      });
      this.logger.log('##Creating ads placement');
      this.logger.log(adsPlacement);
      const afterSave = adsPlacement.save();
      await session.commitTransaction();
      return afterSave;
    } catch (error: unknown) {
      this.logger.log('cant create ads placement');
      this.logger.log(error);
    }
  };

  addAdsToFeeds = async (viewerAccountId: string, feeds: FeedItemResponse) => {
    const contentIds = feeds.payload
      .filter((item) => item.type === 'content')
      .map((item) => (item.payload as ContentPayloadItem).id);
    const adsplacement = await this.getAdsPlacementFromAuction(
      contentIds,
      viewerAccountId
    );
    const campaign = await this._adsCampaignModel.findById(
      adsplacement.campaign
    );
    let adsItem: FeedItemPayloadItem;
    if (
      campaign.adsRef.$ref === 'content' ||
      campaign.adsRef.namespace === 'content'
    ) {
      const content = await this._contentModel.findById(
        campaign.adsRef.$id ? campaign.adsRef.$id : campaign.adsRef.oid
      );
      adsItem = {
        id: adsplacement.id,
        type: 'ads-content',
        payload: content.toContentPayloadItem(),
        feature: {
          slug: 'feed',
          key: 'feature.feed',
          name: 'Feed',
        },
        circle: {
          id: 'for-you',
          key: 'circle.forYou',
          name: 'For You',
          slug: 'forYou',
        },
        campaignName: campaign.detail.name,
        campaignMessage: campaign.detail.message,
      };
    } else {
      const page = await this._userModel.findById(
        campaign.adsRef.$id ? campaign.adsRef.$id : campaign.adsRef.oid
      );
      adsItem = {
        id: adsplacement.id,
        type: 'ads-page',
        payload: [page.toPageResponse()],
        feature: {
          slug: 'feed',
          key: 'feature.feed',
          name: 'Feed',
        },
        circle: {
          id: 'for-you',
          key: 'circle.forYou',
          name: 'For You',
          slug: 'forYou',
        },
        campaignName: campaign.detail.name,
        campaignMessage: campaign.detail.message,
      };
    }
    feeds.payload = [...feeds.payload, adsItem];
    return feeds;
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
        paymentMethod: adsRequest.paymentMethod,
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
    { sinceId, untilId, maxResults, filter, timezone }: AdsQuery
  ) {
    const filters: FilterQuery<AdsCampaign> = createCastcleFilter(
      { owner: _id },
      {
        sinceId,
        untilId,
      }
    );

    if (filter && filter !== FilterInterval.All) {
      const { startDate, endDate } = CastcleDate.convertDateFilterInterval(
        timezone,
        filter
      );

      filters.createdAt = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    return this._adsCampaignModel
      .find(filters)
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

  async updateAdsById(adsId: string, adsRequest: AdsRequestDto) {
    return this._adsCampaignModel.updateOne(
      { _id: adsId, status: AdsStatus.Processing },
      {
        $set: {
          detail: {
            name: adsRequest.campaignName,
            message: adsRequest.campaignMessage,
            dailyBudget: adsRequest.dailyBudget,
            duration: adsRequest.duration,
          } as AdsDetail,
        },
      }
    );
  }
  async deleteAdsById(adsId: string) {
    return this._adsCampaignModel.deleteOne({
      _id: adsId,
      status: AdsStatus.Processing,
    });
  }

  async updateAdsBoostStatus(adsId: string, adsBoostStatus: AdsBoostStatus) {
    return this._adsCampaignModel.updateOne(
      { _id: adsId, status: AdsStatus.Approved },
      {
        $set: {
          boostStatus: adsBoostStatus,
        },
      }
    );
  }

  seenAds = async (adsPlacementId: string, seenByCredentialId: string) => {
    const adsPlacement = await this._adsPlacementModel.findById(adsPlacementId);
    const session = await this._adsPlacementModel.startSession();
    let tx;
    await session.withTransaction(async () => {
      try {
        if (adsPlacement && !adsPlacement.seenAt) {
          adsPlacement.seenAt = new Date();
          adsPlacement.seenCredential = mongoose.Types.ObjectId(
            seenByCredentialId
          ) as any;
          const adsCampaign = await this._adsCampaignModel.findById(
            adsPlacement.campaign
          );
          const estAdsCostCAST =
            adsPlacement.cost.UST / mockOracleService.getCastPrice();
          //transferFrom ads owner to locked account
          //debit personal account or ads_credit account of adsowner
          //credit ads ownner locked_for ads
          tx = await this.taccountService.transfers({
            from: {
              account: adsCampaign.owner as unknown as string,
              type:
                adsCampaign.detail.paymentMethod === AdsPaymentMethod.ADS_CREDIT
                  ? WalletType.ADS
                  : WalletType.PERSONAL,
              value: estAdsCostCAST,
            },
            to: [
              {
                type: WalletType.CASTCLE_ADS_LOCKED,
                value: estAdsCostCAST,
              },
            ],
            ledgers: [
              {
                debit: {
                  caccountNo:
                    adsCampaign.detail.paymentMethod ===
                    AdsPaymentMethod.ADS_CREDIT
                      ? CACCOUNT_NO.LIABILITY.USER_WALLET.ADS
                      : CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
                  value: estAdsCostCAST,
                },
                credit: {
                  caccountNo: CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.ADS,
                  value: estAdsCostCAST,
                },
              },
            ],
          });
          await adsPlacement.save();
          adsCampaign.statistics.budgetSpent += adsPlacement.cost.UST;
          const adsOwnerBalance = await this.taccountService.getAccountBalance(
            String(adsCampaign.owner),
            adsCampaign.detail.paymentMethod === AdsPaymentMethod.ADS_CREDIT
              ? WalletType.ADS
              : WalletType.PERSONAL
          );
          //if balance < 1 CAST THen pause ads
          if (
            adsOwnerBalance - adsPlacement.cost.UST <=
            mockOracleService.getCastPrice()
          )
            adsCampaign.boostStatus = AdsBoostStatus.Pause;
          adsCampaign.markModified('statistics');
          await adsCampaign.save();
          // adsCampaign.owner
          //if(adsCampaign.statistics.budgetSpent >=  )
          //stop campaign if adsBalance = 0;
          //if(adsCampaign.statistics.budgetSpent)
        }
        await session.endSession();
      } catch (error: unknown) {
        await session.abortTransaction();
        this.logger.error(error);
      }
    });
    return tx
      ? {
          adsPlacement: adsPlacement,
          txId: tx.id,
        }
      : {
          adsPlacement: adsPlacement,
        };
  };
}
