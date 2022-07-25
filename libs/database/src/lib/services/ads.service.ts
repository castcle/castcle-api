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
import { DBRef } from 'mongodb';
import { ClientSession, Document, FilterQuery, Model, Types } from 'mongoose';
import {
  GetAdsPriceResponse,
  pipe2AvailableAdsCampaign,
} from '../aggregations/ads.aggregation';
import {
  AdsQuery,
  AdsRequestDto,
  AdsResponse,
  ContentPayloadItem,
  FeedItemPayloadItem,
  FeedItemResponse,
} from '../dtos';
import {
  AdsBoostStatus,
  AdsBoostType,
  AdsCpm,
  AdsPaymentMethod,
  AdsPlacementContent,
  AdsSocialReward,
  AdsStatus,
  CACCOUNT_NO,
  DefaultAdsStatistic,
  FilterInterval,
  UserType,
  WalletType,
} from '../models';
import { Repository } from '../repositories/index';
import {
  AdsCampaign as Ad,
  AdsPlacement,
  Content,
  ContentFarming,
  MicroTransaction,
  TLedger,
  User,
} from '../schemas';
import { AdsDetail } from '../schemas/ads-detail.schema';
import { createCastcleFilter } from '../utils/common';
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
  private logger = new CastLogger(AdsService.name);

  constructor(
    @InjectModel('AdsCampaign') private adsModel: Model<Ad>,
    @InjectModel('AdsPlacement') private adsPlacementModel: Model<AdsPlacement>,
    @InjectModel('Content') private contentModel: Model<Content>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('ContentFarming') private farmingModel: Model<ContentFarming>,
    private dataService: DataService,
    private tAccountService: TAccountService,
    private repository: Repository,
  ) {}

  async find(dto: {
    adStatus: AdsStatus[];
    boostStatus: AdsBoostStatus[];
    boostType: AdsBoostType[];
  }) {
    const query: FilterQuery<Ad> = {};
    if (dto.adStatus) query.status = { $in: dto.adStatus };
    if (dto.boostStatus) query.boostStatus = { $in: dto.boostStatus };
    if (dto.boostType) query['adsRef.$ref'] = { $in: dto.boostType };

    const campaigns = await this.adsModel
      .find(query)
      .sort({ createdAt: 'desc' });

    return campaigns;
  }

  private isContentAd = (ad: { adsRef: DBRef }) => {
    return ad.adsRef.namespace === AdsBoostType.Content;
  };

  private isPayloadOf = (ad: { adsRef: DBRef }) => {
    return ({ _id }: Document) => String(_id) === String(ad.adsRef.oid);
  };

  convertAdsToAdResponses = async (ads: Ad[]) => {
    const contentIds = [];
    const userIds = [];

    ads.forEach((ad) => {
      (this.isContentAd(ad) ? userIds : contentIds).push(ad.adsRef.oid);
    });

    const [contents, users] = await Promise.all([
      this.contentModel.find({ _id: { $in: contentIds } }),
      this.userModel.find({ _id: { $in: userIds } }),
    ]);

    return ads.map<AdsResponse>((ad) => ({
      campaignName: ad.detail.name,
      campaignMessage: ad.detail.message,
      adStatus: ad.status,
      boostStatus: ad.boostStatus,
      boostType: this.isContentAd(ad)
        ? AdsBoostType.Content
        : AdsBoostType.Page,
      campaignCode: ad.detail.code,
      dailyBudget: ad.detail.dailyBudget,
      duration: ad.detail.duration,
      dailyBidType: ad.detail.dailyBidType,
      dailyBidValue: ad.detail.dailyBidValue,
      objective: ad.objective,
      payload: this.isContentAd(ad)
        ? contents.find(this.isPayloadOf(ad))?.toContentPayloadItem()
        : users.find(this.isPayloadOf(ad))?.toPublicResponse(),
      engagement: ad.statistics.engagements,
      statistics: {
        CPM: ad.statistics.cpm,
        budgetSpent: ad.statistics.budgetSpent,
        dailySpent: ad.statistics.dailySpent,
        impression: { organic: 0, paid: 0 },
        reach: { organic: 0, paid: 0 },
      },
      createdAt: ad.createdAt,
      updatedAt: ad.updatedAt,
    }));
  };

  approveAd = async (adId: string) => {
    const ad = await this.adsModel.findById(adId);
    if (!ad) throw new CastcleException('AD_NOT_FOUND');
    if (ad.status === AdsStatus.Processing) {
      ad.boostStatus = AdsBoostStatus.Running;
      ad.status = AdsStatus.Approved;
      return ad.save();
    }
    if (ad.status === AdsStatus.Declined) {
      ad.status = AdsStatus.Approved;
      return ad.save();
    }

    throw new CastcleException('ACTION_CANNOT_BE_COMPLETED');
  };

  declineAd = async (adId: string, statusReason: string) => {
    const ad = await this.adsModel.findById(adId);
    if (!ad) throw new CastcleException('AD_NOT_FOUND');
    if (![AdsStatus.Approved, AdsStatus.Processing].includes(ad.status)) {
      throw new CastcleException('ACTION_CANNOT_BE_COMPLETED');
    }

    return ad.set({ status: AdsStatus.Declined, statusReason }).save();
  };

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
      (item) => String(item.oid) === sortedContentIds[0],
    );
    return adsPrice.ads[adsIndex];
  };

  selectAdsFromActiveAds = async (
    adsPrice: GetAdsPriceResponse,
    viewerAccountId: string,
  ) => {
    const contentIds = [];
    const userIds = [];

    adsPrice.adsRef.forEach((adsRef) => {
      (this.isContentAd({ adsRef }) ? userIds : contentIds).push(adsRef.oid);
    });

    if (contentIds.length && userIds.length) {
      const selectedContentAds = await this.selectContentAds(
        adsPrice,
        viewerAccountId,
        contentIds,
      );
      return (
        selectedContentAds ||
        adsPrice.ads[Math.floor(Math.random() * adsPrice.ads.length)]
      );
    }
    return adsPrice.ads[Math.floor(Math.random() * adsPrice.ads.length)];
  };

  getAdsPlacementFromAuction = async (
    contentIds: AdsPlacementContent[],
    viewerAccountId: string,
  ) => {
    const session = await this.adsPlacementModel.startSession();
    try {
      session.startTransaction();
      const cpm = await this.auctionAds(viewerAccountId);
      const user = await this.repository.findUser({
        accountId: viewerAccountId,
        type: UserType.PEOPLE,
      });
      const adsPlacement = new this.adsPlacementModel({
        campaign: cpm.adsCampaignId,
        contents: contentIds.map((c) => c.contentId),
        cost: {
          UST: cpm.biddingCpm,
        },
        viewer: user._id,
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
          } as AdsPlacementContent),
      );
    const adsplacement = await this.getAdsPlacementFromAuction(
      contentIds,
      viewerAccountId,
    );
    const campaign = await this.adsModel.findById(adsplacement.campaign);
    let adsItem: FeedItemPayloadItem;
    if (campaign.adsRef.namespace === 'content') {
      const content = await this.contentModel.findById(campaign.adsRef.oid);
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
      const page = await this.userModel.findById(campaign.adsRef.oid);
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

  /**
   * Validate if ads owner can create ads or not
   * @param user
   * @param adsRequest
   * @returns
   */
  validateAds = async (user: User, adsRequest: AdsRequestDto) => {
    const balance = await this.tAccountService.getAccountBalance(
      user.id,
      adsRequest.paymentMethod === AdsPaymentMethod.ADS_CREDIT
        ? WalletType.ADS
        : WalletType.PERSONAL,
    );
    //invalid balance
    if (!(balance / mockOracleService.getCastPrice() >= adsRequest.dailyBudget))
      return false;
    if (adsRequest.castcleId && user.id !== adsRequest.castcleId) {
      const page = await this.userModel.findById(adsRequest.castcleId);
      return String(page.ownerAccount) === String(user.ownerAccount);
    } else if (adsRequest.contentId) {
      const content = await this.contentModel.findById(adsRequest.contentId);
      return String(content.author.id) === String(user._id);
    }
    return true;
  };

  updateAllAdsStatus = async () => {
    const runningCampaigns = await this.adsModel.find({
      boostStatus: AdsBoostStatus.Running,
    });
    //update daily Spent

    runningCampaigns[0].statistics.dailySpent = 0;
  };

  /**
   * Create a ads campaign
   * @param user
   * @param adsRequest
   * @returns {Ad}
   */
  createAds = async (user: User, adsRequest: AdsRequestDto) => {
    const adsRef = adsRequest.castcleId
      ? new DBRef('user', new Types.ObjectId(adsRequest.castcleId))
      : new DBRef('content', new Types.ObjectId(adsRequest.contentId));

    if (!(await this.validateAds(user, adsRequest)))
      throw new CastcleException('INVALID_TRANSACTIONS_DATA');

    return new this.adsModel({
      adsRef: adsRef,
      owner: user.id,
      objective: adsRequest.objective,
      detail: {
        name: adsRequest.campaignName,
        message: adsRequest.campaignMessage,
        code: user._id + Math.random(), //TODO !!! have to change according to biz logic for example ADSPAGE00001  = 1 ads that promote page or it have to linked with owner account from the code
        dailyBudget: adsRequest.dailyBudget,
        duration: adsRequest.duration,
        paymentMethod: adsRequest.paymentMethod,
        dailyBidType: adsRequest.dailyBidType,
        dailyBidValue: adsRequest.dailyBidValue,
      } as AdsDetail,
      statistics: DefaultAdsStatistic,
      status: AdsStatus.Processing,
      boostStatus: AdsBoostStatus.Unknown,
    }).save();
  };

  async _getUserIds(ownerAccount: any, _id: any) {
    const pages = await this.userModel.find({
      ownerAccount: ownerAccount,
      type: UserType.PAGE,
    });
    const ids = pages.map((p) => p._id);
    ids.push(_id);
    return ids;
  }

  async getListAds(
    { _id, ownerAccount }: User,
    { sinceId, untilId, maxResults, filter, timezone }: AdsQuery,
  ) {
    const ids = await this._getUserIds(ownerAccount, _id);
    const filters: FilterQuery<Ad> = createCastcleFilter(
      { owner: { $in: ids } },
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

    return this.adsModel
      .find(filters)
      .limit(maxResults)
      .sort({ createdAt: -1, _id: -1 });
  }

  async lookupAds({ _id, ownerAccount }: User, adsId: string) {
    const ids = await this._getUserIds(ownerAccount, _id);
    ids.push(_id);
    return this.adsModel
      .findOne({
        owner: { $in: ids },
        _id: adsId,
      })
      .exec();
  }

  async updateAdsById(adsId: string, adsRequest: AdsRequestDto) {
    return this.adsModel.updateOne(
      { _id: adsId, status: AdsStatus.Processing },
      {
        $set: {
          detail: {
            name: adsRequest.campaignName,
            message: adsRequest.campaignMessage,
            dailyBudget: adsRequest.dailyBudget,
            duration: adsRequest.duration,
            dailyBidValue: adsRequest.dailyBidValue,
          } as AdsDetail,
        },
      },
    );
  }
  async deleteAdsById(adsId: string) {
    return this.adsModel.deleteOne({
      _id: adsId,
      status: AdsStatus.Processing,
    });
  }

  async updateAdsBoostStatus(adsId: string, adsBoostStatus: AdsBoostStatus) {
    return this.adsModel.updateOne(
      { _id: adsId, status: AdsStatus.Approved },
      {
        $set: {
          boostStatus: adsBoostStatus,
        },
      },
    );
  }

  seenAds = async (adsPlacementId: string, seenByCredentialId: string) => {
    const adsPlacement = await this.adsPlacementModel.findById(adsPlacementId);
    const session = await this.adsPlacementModel.startSession();
    let tx;
    await session.withTransaction(async () => {
      try {
        if (adsPlacement && !adsPlacement.seenAt) {
          adsPlacement.seenAt = new Date();
          adsPlacement.seenCredential = new Types.ObjectId(
            seenByCredentialId,
          ) as any;
          const adsCampaign = await this.adsModel.findById(
            adsPlacement.campaign,
          );
          const estAdsCostCAST =
            adsPlacement.cost.UST / mockOracleService.getCastPrice();
          //transferFrom ads owner to locked account
          //debit personal account or ads_credit account of adsowner
          //credit ads ownner locked_for ads
          tx = await this.tAccountService.transfer({
            from: {
              user: adsCampaign.owner as unknown as string,
              type:
                adsCampaign.detail.paymentMethod === AdsPaymentMethod.ADS_CREDIT
                  ? WalletType.ADS
                  : WalletType.PERSONAL,
              value: estAdsCostCAST,
            },
            to: [
              {
                type: WalletType.CASTCLE_SOCIAL,
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
                      ? CACCOUNT_NO.SOCIAL_REWARD.ADS_CREDIT.NO
                      : CACCOUNT_NO.SOCIAL_REWARD.PERSONAL.NO,
                  value: estAdsCostCAST,
                },
              },
            ],
          });
          await adsPlacement.save();
          adsCampaign.statistics.budgetSpent += adsPlacement.cost.UST;
          adsCampaign.statistics.dailySpent += adsPlacement.cost.UST;
          adsCampaign.statistics.lastSeenAt = new Date();
          const adsOwnerBalance = await this.tAccountService.getAccountBalance(
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
    const ads = await this.adsModel
      .aggregate(pipe2AvailableAdsCampaign())
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
        adsCpm.adsCampaignId = String(sortedAds._id);
        return adsCpm;
      });
  };

  auctionAds = async (accountId: string) => (await this.getAds(accountId))[0];

  distributeAllSocialRewardByType = async (paymentType: AdsPaymentMethod) => {
    const castRate = await this.repository.getCastUSDDistributeRate();
    const adsPlacements = await this.repository.getUndistributedAdsplacements(
      paymentType,
    );
    for (let i = 0; i < adsPlacements.length; i++) {
      const adsplacement = adsPlacements[i]; //sometimes use forEach there would be a bug in await
      adsplacement.cost.CAST = adsplacement.cost.UST * castRate;
      const reward = new AdsSocialReward(paymentType, adsplacement.cost);
      const session = await this.adsPlacementModel.startSession();
      session.withTransaction(async () => {
        await this.distributeAdsReward(adsplacement, reward, session);
        adsplacement.isModified('cost');
        await adsplacement.save();
      });
      session.endSession();
    }
  };

  distributeAdsReward = async (
    adsplacement: AdsPlacement,
    reward: AdsSocialReward,
    session: ClientSession,
  ) => {
    await this.distributeContentFarmingReward(adsplacement, reward, session);
    await this.distributeContentCreatorReward(adsplacement, reward, session);
    await this.distributeViewerReward(adsplacement, reward, session);
  };

  distributeViewerReward = async (
    adsplacement: AdsPlacement,
    reward: AdsSocialReward,
    session: ClientSession,
  ) => {
    return this.tAccountService.transfer(
      {
        from: {
          type: WalletType.CASTCLE_SOCIAL,
          value: reward.viewerShare,
        },
        to: [
          {
            user: adsplacement.user as unknown as string,
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
                  ? CACCOUNT_NO.SOCIAL_REWARD.ADS_CREDIT.NO
                  : CACCOUNT_NO.SOCIAL_REWARD.PERSONAL.NO,
              value: reward.viewerShare,
            },
            credit: {
              caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
              value: reward.viewerShare,
            },
          },
        ],
      },
      session,
    );
  };

  distributeContentCreatorReward = async (
    adsplacement: AdsPlacement,
    reward: AdsSocialReward,
    session: ClientSession,
  ) => {
    const creatorRewardPerContent =
      reward.creatorShare / adsplacement.contents.length;
    const transferTo: MicroTransaction[] = [];
    const ledgers: TLedger[] = [];
    for (let i = 0; i < adsplacement.contents.length; i++) {
      const rewardPerContent = creatorRewardPerContent;
      transferTo.push({
        user: adsplacement.contents[i].authorId,
        type: WalletType.PERSONAL,
        value: rewardPerContent,
      });
      ledgers.push({
        debit: {
          caccountNo:
            adsplacement.campaign.campaignPaymentType ===
            AdsPaymentMethod.ADS_CREDIT
              ? CACCOUNT_NO.SOCIAL_REWARD.ADS_CREDIT.NO
              : CACCOUNT_NO.SOCIAL_REWARD.PERSONAL.NO,
          value: rewardPerContent,
        },
        credit: {
          caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
          value: rewardPerContent,
        },
      });
    }
    return this.tAccountService.transfer(
      {
        from: {
          type: WalletType.CASTCLE_SOCIAL,
          value: reward.creatorShare,
        },
        to: transferTo,
        ledgers: ledgers,
      },
      session,
    );
  };

  distributeContentFarmingReward = async (
    adsplacement: AdsPlacement,
    reward: AdsSocialReward,
    session: ClientSession,
  ) => {
    // const creatorPool = reward.creatorShare + reward.farmingShare;
    const creatorRewardPerContent =
      reward.farmingShare / adsplacement.contents.length; //creatorPool / adsplacement.contents.length;

    const cfs = await this.farmingModel.find({
      content: {
        $in: adsplacement.contents.map((c) => String(c)),
      },
    });

    for (let j = 0; j < adsplacement.contents.length; j++) {
      const currentCfs = cfs.filter(
        (c) => String(c.content) === adsplacement.contents[j].contentId,
      );
      if (currentCfs.length > 0) {
        const transferTo: MicroTransaction[] = [];
        const ledgers: TLedger[] = [];
        for (let i = 0; i < currentCfs.length; i++) {
          const rewardContent =
            currentCfs[i].weight *
            (reward.farmingShare /
              (reward.farmingShare + reward.creatorShare)) *
            creatorRewardPerContent;
          transferTo.push({
            user: String(currentCfs[i].user),
            type: WalletType.PERSONAL,
            value: rewardContent,
          });
          ledgers.push({
            debit: {
              caccountNo:
                adsplacement.campaign.campaignPaymentType ===
                AdsPaymentMethod.ADS_CREDIT
                  ? CACCOUNT_NO.SOCIAL_REWARD.ADS_CREDIT.NO
                  : CACCOUNT_NO.SOCIAL_REWARD.PERSONAL.NO,
              value: rewardContent,
            },
            credit: {
              caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
              value: rewardContent,
            },
          });
        }
        await this.farmingModel.updateMany(
          { _id: { $in: currentCfs.map((c) => c.id) } },
          {
            isDistributed: true,
          },
          { session: session },
        );
        await this.contentModel.updateMany(
          { _id: { $in: currentCfs.map((c) => c.content) } },
          { 'farming.isDistributed': true },
        );
        await this.tAccountService.transfer(
          {
            from: {
              type: WalletType.CASTCLE_SOCIAL,
              value: reward.farmingShare,
            },
            to: transferTo,
            ledgers: ledgers,
          },
          session,
        );
      } else {
        await this.tAccountService.transfer(
          {
            from: {
              type: WalletType.CASTCLE_SOCIAL,
              value: creatorRewardPerContent,
            },
            to: [
              {
                type: WalletType.PERSONAL,
                value: creatorRewardPerContent,
                user: adsplacement.contents[j].authorId,
              },
            ],
            ledgers: [
              {
                debit: {
                  caccountNo:
                    adsplacement.campaign.campaignPaymentType ===
                    AdsPaymentMethod.ADS_CREDIT
                      ? CACCOUNT_NO.SOCIAL_REWARD.ADS_CREDIT.NO
                      : CACCOUNT_NO.SOCIAL_REWARD.PERSONAL.NO,
                  value: creatorRewardPerContent,
                },
                credit: {
                  caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
                  value: creatorRewardPerContent,
                },
              },
            ],
          },
          session,
        );
      }
    }
  };
}
