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
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CastcleDate } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  GetAdsPriceResponse,
  pipe2AvaialableAdsCampaign,
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
  AdsCpm,
  AdsPaymentMethod,
  AdsPlacementCampaign,
  AdsPlacementContent,
  AdsSocialReward,
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
  ContentFarming,
  toSignedContentPayloadItem,
  User,
} from '../schemas';
import { AdsDetail } from '../schemas/ads-detail.schema';
import { createCastcleFilter } from '../utils/common';
import { FilterInterval } from './../models/ads.enum';
import { DataService } from './data.service';
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
    public taccountService: TAccountService,
    public dataService: DataService,
    @InjectModel('ContentFarming')
    public _contentFarmingModel: Model<ContentFarming>
  ) {}

  private logger = new CastLogger(AdsService.name);

  selectContentAds = async (
    adsPrice: GetAdsPriceResponse,
    viewerAccountId: string,
    allContentAdsIds: string[],
  ) => {
    const contentScore = await this.dataService.personalizeContents(
      viewerAccountId,
      allContentAdsIds,
    );
    if (!(contentScore && Object.keys(contentScore).length > 0)) return null;
    const sortedContentIds = Object.keys(contentScore).sort((a, b) =>
      contentScore[a] > contentScore[b] ? -1 : 1,
    );
    const adsIndex = adsPrice.adsRef.findIndex(
      (item) => String(item.$id || item.oid) === sortedContentIds[0],
    );
    return adsPrice.ads[adsIndex];
  };

  selectAdsFromActiveAds = async (
    adsPrice: GetAdsPriceResponse,
    viewerAccountId: string,
  ) => {
    const allContentAdsIds = adsPrice.adsRef
      .filter((item) => item.$ref === 'content' || item.namespace === 'content')
      .map((item) => String(item.$id ? item.$id : item.oid));
    const allUserAdsIds = adsPrice.adsRef
      .filter((item) => item.$ref === 'user' || item.namespace === 'user')
      .map((item) => String(item.$id ? item.$id : item.oid));
    if (allContentAdsIds.length > 0 && allUserAdsIds.length > 0) {
      const selectedContentAds = await this.selectContentAds(
        adsPrice,
        viewerAccountId,
        allContentAdsIds,
      );
      return selectedContentAds
        ? selectedContentAds
        : adsPrice.ads[Math.floor(Math.random() * adsPrice.ads.length)];
    }
    return adsPrice.ads[Math.floor(Math.random() * adsPrice.ads.length)];
  };

  getAdsPlacementFromAuction = async (
    contentIds: string[],
    viewerAccountId: string,
  ) => {
    const session = await this._adsPlacementModel.startSession();
    try {
      session.startTransaction();
      const cpm = await this.auctionAds(viewerAccountId);
      const adsPlacement = new this._adsPlacementModel({
        campaign: cpm.adsCampignId,
        contents: contentIds,
        cost: {
          UST: cpm.biddingCpm,
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
      .map(
        (item) =>
          ({
            contentId: (item.payload as ContentPayloadItem).id,
            authorId: (item.payload as ContentPayloadItem).authorId,
          } as AdsPlacementContent)
      );
    const adsplacement = await this.getAdsPlacementFromAuction(
      contentIds,
      viewerAccountId,
    );
    const campaign = await this._adsCampaignModel.findById(
      adsplacement.campaign,
    );
    let adsItem: FeedItemPayloadItem;
    if (
      campaign.adsRef.$ref === 'content' ||
      campaign.adsRef.namespace === 'content'
    ) {
      const content = await this._contentModel.findById(
        campaign.adsRef.$id ? campaign.adsRef.$id : campaign.adsRef.oid,
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
        campaign.adsRef.$id ? campaign.adsRef.$id : campaign.adsRef.oid,
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
   * Validate if ads owner can create ads or not
   * @param account
   * @param adsRequest
   * @returns
   */
  validateAds = async (user: User, adsRequest: AdsRequestDto) => {
    const balance = await this.taccountService.getAccountBalance(
      user.id,
      adsRequest.paymentMethod === AdsPaymentMethod.ADS_CREDIT
        ? WalletType.ADS
        : WalletType.PERSONAL,
    );
    //invalid balance
    if (!(balance / mockOracleService.getCastPrice() >= adsRequest.dailyBudget))
      return false;
    return true;
  };

  /**
   * Create a ads campaign
   * @param account
   * @param adsRequest
   * @returns {AdsCampaign}
   */
  createAds = async (user: User, adsRequest: AdsRequestDto) => {
    const adsRef = adsRequest.userId
      ? {
          $ref: 'user',
          $id: new mongoose.Types.ObjectId(adsRequest.userId),
        }
      : {
          $ref: 'content',
          $id: new mongoose.Types.ObjectId(adsRequest.contentId),
        };
    if (!(await this.validateAds(user, adsRequest)))
      throw CastcleException.INVALID_TRANSACTIONS_DATA;
    //TODO !!! have to validate if account have enough balance
    const campaign = new this._adsCampaignModel({
      adsRef: adsRef,
      owner: user.ownerAccount,
      objective: adsRequest.objective,
      detail: {
        name: adsRequest.campaignName,
        message: adsRequest.campaignMessage,
        code: user._id + Math.random(), //TODO !!! have to change according to biz logic for example ADSPAGE00001  = 1 ads that promote page or it have to linked with owner account from the code
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
        campaign.adsRef.$id || campaign.adsRef.oid,
      );
      payload = page.toPageResponse();
    } else {
      const content = await this._contentModel.findById(
        campaign.adsRef.$id || campaign.adsRef.oid,
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
    { sinceId, untilId, maxResults, filter, timezone }: AdsQuery,
  ) {
    const filters: FilterQuery<AdsCampaign> = createCastcleFilter(
      { owner: _id },
      {
        sinceId,
        untilId,
      },
    );

    if (filter && filter !== FilterInterval.All) {
      const { startDate, endDate } = CastcleDate.convertDateFilterInterval(
        timezone,
        filter,
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
      },
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
      },
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
            seenByCredentialId,
          ) as any;
          const adsCampaign = await this._adsCampaignModel.findById(
            adsPlacement.campaign,
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
                  caccountNo:
                    adsCampaign.detail.paymentMethod ===
                    AdsPaymentMethod.ADS_CREDIT
                      ? CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.ADS_CREDIT.NO
                      : CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.ADS,
                  value: estAdsCostCAST,
                },
              },
            ],
          });
          await adsPlacement.save();
          adsCampaign.statistics.budgetSpent += adsPlacement.cost.UST;
          adsCampaign.statistics.dailySpent += adsPlacement.cost.UST;
          const adsOwnerBalance = await this.taccountService.getAccountBalance(
            String(adsCampaign.owner),
            adsCampaign.detail.paymentMethod === AdsPaymentMethod.ADS_CREDIT
              ? WalletType.ADS
              : WalletType.PERSONAL,
          );
          //if balance < 1 CAST THen pause ads
          if (
            adsOwnerBalance - adsPlacement.cost.UST <=
            mockOracleService.getCastPrice()
          )
            adsCampaign.boostStatus = AdsBoostStatus.Pause;
          adsCampaign.markModified('statistics');
          await adsCampaign.save();
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

  getAds = async (accountId: string) => {
    //select all ads that user Balance > budget
    const ads = await this._adsCampaignModel
      .aggregate(pipe2AvaialableAdsCampaign())
      .exec();
    const releventScore = await this.dataService.personalizeContents(
      accountId,
      ads.map((a) => a.adsRef.$id || a.adsRef.oid),
    );
    return ads
      .sort(
        (a, b) =>
          releventScore[b.adsRef.$id || b.adsRef.oid] -
          releventScore[a.adsRef.$id || a.adsRef.oid],
      )
      .map((sortedAds, index) => {
        const adsCpm: AdsCpm = {
          cpm:
            ads.length * Environment.ADS_MINIMUM_CPM > sortedAds.budgetLeft
              ? sortedAds.budgetLeft
              : ads.length * Environment.ADS_MINIMUM_CPM,
        };
        const bid =
          index === ads.length - 1
            ? Environment.ADS_MINIMUM_CPM
            : Math.min(
                (ads.length - index) * Environment.ADS_MINIMUM_CPM,
                adsCpm.cpm,
              );
        adsCpm.biddingCpm = bid;
        adsCpm.relevanceScore =
          releventScore[sortedAds.adsRef.$id || sortedAds.adsRef.oid];
        adsCpm.rankingScore = adsCpm.relevanceScore * adsCpm.biddingCpm;
        adsCpm.adsCampignId = String(sortedAds._id);
        return adsCpm;
      });
  };

  auctionAds = async (accountId: string) => (await this.getAds(accountId))[0];

  distributeSocialRewardAdsCredit = async () => {
    //assume all conterm farming has been weigh
    const adsIncomeToken = await this.taccountService.getBalance(
      CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.ADS_CREDIT.NO
    );
    const adsPlacements = await this._adsPlacementModel.find({
      'cost.CAST': { $exits: false },
    });
    //gety cost UST in aggregation
    const totalCost = adsPlacements.reduce((a, b) => a + b.cost.UST, 0);
    const castActualCost = totalCost / adsIncomeToken;
    for (let i = 0; i < adsPlacements.length; i++) {
      const adsplacement = adsPlacements[i];
      adsplacement.cost.CAST = adsplacement.cost.UST / castActualCost;
      const reward: AdsSocialReward = {
        adsCost: adsplacement.cost.CAST,
        castcleShare: 0,
        creatorShare: 0.5 * adsplacement.cost.CAST,
        farmingShare: 0.3 * adsplacement.cost.CAST,
        viewerShare: 0.2 * adsplacement.cost.CAST,
      };
      const session = await this._adsPlacementModel.startSession();
      session.withTransaction(async () => {
        await this.distributeAdsReward(adsplacement, reward);
        adsplacement.isModified('cost');
        await adsplacement.save();
      });
      session.endSession();
    }
  };

  distributeSocialRewardPersonal = async () => {
    const adsIncomeToken = await this.taccountService.getBalance(
      CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.NO
    );
    const adsPlacements = await this._adsPlacementModel.find({
      'cost.CAST': { $exits: false },
    });
    //gety cost UST in aggregation
    const totalCost = adsPlacements.reduce((a, b) => a + b.cost.UST, 0);
    const castActualCost = totalCost / adsIncomeToken;
    for (let i = 0; i < adsPlacements.length; i++) {
      const adsplacement = adsPlacements[i];
      adsplacement.cost.CAST = adsplacement.cost.UST / castActualCost;
      const reward: AdsSocialReward = {
        adsCost: adsplacement.cost.CAST,
        castcleShare: 0.3 * adsplacement.cost.CAST,
        creatorShare: 0.35 * adsplacement.cost.CAST,
        farmingShare: 0.21 * adsplacement.cost.CAST,
        viewerShare: 0.14 * adsplacement.cost.CAST,
      };
      const session = await this._adsPlacementModel.startSession();
      session.withTransaction(async () => {
        await this.distributeAdsReward(adsplacement, reward);
        adsplacement.isModified('cost');
        await adsplacement.save();
      });
      session.endSession();
    }
  };

  distributeAdsReward = async (
    adsplacement: AdsPlacement,
    reward: AdsSocialReward
  ) => {
    //castRate = 1/castActualCost;

    //distribute Content Farming
    await this.distributeContentFarmingReward(adsplacement, reward);
    await this.distributeContentCreatorReward(adsplacement, reward);
    return this.taccountService.transfers({
      from: {
        type: WalletType.CASTCLE_ADS_LOCKED,
        value: reward.viewerShare,
      },
      to: [
        {
          account: adsplacement.viewer as unknown as string,
          type: WalletType.PERSONAL,
          value: reward.viewerShare,
        },
      ],
      ledgers: [
        {
          debit: {
            caccountNo:
              adsplacement.campaign.campaignPaymentType ===
              AdsPaymentMethod.ADS_CREDIT
                ? CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.ADS_CREDIT.NO
                : CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.NO,
            value: reward.viewerShare,
          },
          credit: {
            caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
            value: reward.viewerShare,
          },
        },
      ],
    });
  };

  distributeContentCreatorReward = async (
    adsplacement: AdsPlacement,
    reward: AdsSocialReward
  ) => {
    //!!! TODO should embed in adsplacement

    const transferTo: any[] = [];
    const ledgers: any[] = [];
    for (let i = 0; i < adsplacement.contents.length; i++) {
      //contents[i].author.id get author id from this
      const user = await this._userModel.findById(
        adsplacement.contents[i].authorId
      );
      const rewardPerContent =
        reward.creatorShare / adsplacement.contents.length;
      transferTo.push({
        account: user.ownerAccount.id,
        type: WalletType.PERSONAL,
        value: rewardPerContent,
      });
      ledgers.push({
        debit: {
          caccountNo:
            adsplacement.campaign.campaignPaymentType ===
            AdsPaymentMethod.ADS_CREDIT
              ? CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.ADS_CREDIT.NO
              : CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.NO,
          value: rewardPerContent,
        },
        credit: {
          caccountSourceNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
          value: rewardPerContent,
        },
      });
    }
    return this.taccountService.transfers({
      from: {
        type: WalletType.CASTCLE_ADS_LOCKED,
        value: reward.creatorShare,
      },
      to: transferTo,
      ledgers: ledgers,
    });
  };

  distributeContentFarmingReward = async (
    adsplacement: AdsPlacement,
    reward: AdsSocialReward
  ) => {
    const cfs = await this._contentFarmingModel.find({
      content: {
        $in: adsplacement.contents.map((c) => String(c)),
      },
    });
    const transferTo: any[] = [];
    const ledgers: any[] = [];
    for (let i = 0; i < cfs.length; i++) {
      cfs[i].isDistributed = true;
      const rewardContent = cfs[i].weight * reward.farmingShare;
      transferTo.push({
        account: String(cfs[i].account),
        type: WalletType.PERSONAL,
        value: rewardContent,
      });
      ledgers.push({
        debit: {
          caccountNo:
            adsplacement.campaign.campaignPaymentType ===
            AdsPaymentMethod.ADS_CREDIT
              ? CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.ADS_CREDIT.NO
              : CACCOUNT_NO.LIABILITY.LOCKED_TOKEN.PERSONAL.NO,
          value: rewardContent,
        },
        credit: {
          caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
          value: rewardContent,
        },
      });
    }
    Promise.all(cfs.map((cf) => cf.save()));
    return this.taccountService.transfers({
      from: {
        type: WalletType.CASTCLE_ADS_LOCKED,
        value: reward.farmingShare,
      },
      to: transferTo,
      ledgers: ledgers,
    });

    //transfer rewardContent from ads credit lock to cfs[0].account;
  };
}
