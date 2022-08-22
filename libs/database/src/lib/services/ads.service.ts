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
import { CastcleDate, LocalizationLang } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
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
  Author,
  CastcleIncludes,
  ContentPayloadItem,
  FeedItemPayloadItem,
  FeedItemResponse,
  Meta,
  NotificationSource,
  NotificationType,
  ResponseDto,
} from '../dtos';
import {
  AdsBoostStatus,
  AdsBoostType,
  AdsCpm,
  AdsPaymentMethod,
  AdsPlacementContent,
  AdsSocialReward,
  AdsStatus,
  CAccountNo,
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
import { NotificationServiceV2 } from './notification.service.v2';
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
    private notificationService: NotificationServiceV2,
  ) {}

  private runningCodeAd = () => {
    const dateString = String(Date.now());
    return `ADS${dateString.substring(
      dateString.length - 5,
      dateString.length,
    )}`;
  };

  private isContentAd = (ad: { adsRef: DBRef }) => {
    return ad.adsRef.collection === AdsBoostType.Content;
  };

  private isPayloadOf = (ad: { adsRef: DBRef }) => {
    return ({ _id }: Document) => String(_id) === String(ad.adsRef.oid);
  };

  private _getUserIds = async (ownerAccount: any, _id: any) => {
    const pages = await this.userModel.find({
      ownerAccount: ownerAccount,
      type: UserType.PAGE,
    });

    const ids = pages.map((p) => p._id);

    return [...ids, _id];
  };

  private validateAds = async (user: User, adsRequest: AdsRequestDto) => {
    const balance = await this.tAccountService.getAccountBalance(
      user.id,
      adsRequest.paymentMethod === AdsPaymentMethod.ADS_CREDIT
        ? WalletType.ADS
        : WalletType.PERSONAL,
    );
    this.logger.log(
      `balance : ${balance}
       cast price : ${balance / mockOracleService.getCastPrice()}
       daily budget : ${adsRequest.dailyBudget}
      `,
      'validateAds:checking',
    );

    return balance / mockOracleService.getCastPrice() >= adsRequest.dailyBudget;
  };

  private auctionAds = async (accountId: string) =>
    (await this.getAds(accountId))[0];

  verifyAdsApprove = async (user: User, adsId: string) => {
    const adsCampaign = await this.adsModel
      .findOne({
        owner: user,
        _id: adsId,
      })
      .exec();

    if (adsCampaign?.status !== AdsStatus.Approved) {
      this.logger.log('Ads campaign not found.');
      throw new CastcleException('FORBIDDEN');
    }
    return adsCampaign;
  };

  convertAdsToAdResponses = async (ads: Ad[]) => {
    const contentIds = [];
    const userIds = [];

    ads.forEach((ad) => {
      (this.isContentAd(ad) ? contentIds : userIds).push(ad.adsRef.oid);
    });

    const [contents, users] = await Promise.all([
      this.contentModel.find({ _id: { $in: contentIds } }),
      this.userModel.find({ _id: { $in: userIds } }),
    ]);

    return ads.map<AdsResponse>((ad) => ({
      id: ad._id,
      campaignName: ad.detail.name,
      campaignMessage: ad.detail.message,
      adStatus: ad.status,
      boostStatus: ad.boostStatus,
      boostType: this.isContentAd(ad)
        ? AdsBoostType.Content
        : AdsBoostType.User,
      campaignCode: ad.detail.code,
      dailyBudget: ad.detail.dailyBudget,
      duration: ad.detail.duration,
      dailyBidType: ad.detail.dailyBidType,
      dailyBidValue: ad.detail.dailyBidValue,
      objective: ad.objective,
      startedAt: ad.startAt,
      endedAt: ad.endedAt,
      payload: this.isContentAd(ad)
        ? contents.find(this.isPayloadOf(ad))?.toContentPayloadItem()
        : users.find(this.isPayloadOf(ad))?.toPublicResponse(),
      engagement: ad.statistics.engagements,
      statistics: {
        CPM: ad.statistics.cpm,
        budgetSpent: Number(ad.statistics.budgetSpent),
        dailySpent: Number(ad.statistics.dailySpent),
        impression: { organic: 0, paid: 0 },
        reach: { organic: 0, paid: 0 },
      },
      createdAt: ad.createdAt,
      updatedAt: ad.updatedAt,
    }));
  };

  find = async (dto: {
    adStatus: AdsStatus[];
    boostStatus: AdsBoostStatus[];
    boostType: AdsBoostType[];
  }) => {
    const query: FilterQuery<Ad> = {};
    if (dto.adStatus) query.status = { $in: dto.adStatus };
    if (dto.boostStatus) query.boostStatus = { $in: dto.boostStatus };
    if (dto.boostType) query['adsRef.$ref'] = { $in: dto.boostType };

    return this.adsModel.find(query).sort({ createdAt: 'desc' });
  };

  approveAd = async (adId: string) => {
    const ad = await this.adsModel.findById(adId);
    if (!ad) throw new CastcleException('AD_NOT_FOUND');

    if (![AdsStatus.Declined, AdsStatus.Processing].includes(ad.status)) {
      throw new CastcleException('ACTION_CANNOT_BE_COMPLETED');
    }

    if (ad.status === AdsStatus.Processing) {
      ad.boostStatus = AdsBoostStatus.Running;
      ad.status = AdsStatus.Approved;
    }
    if (ad.status === AdsStatus.Declined) {
      ad.status = AdsStatus.Approved;
    }

    ad.startAt = DateTime.local().toJSDate();
    ad.endedAt = DateTime.local().plus({ days: ad.detail.duration }).toJSDate();

    await ad.save();

    const userOwner = await this.repository.findUser({
      _id: ad.owner as any,
    });

    const accountOwner = await this.repository.findAccount({
      _id: userOwner.ownerAccount as any,
    });

    await this.notificationService.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: undefined,
        type: NotificationType.AdsApprove,
        advertiseId: ad._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      accountOwner?.preferences?.languages[0] || LocalizationLang.English,
    );
  };

  declineAd = async (adId: string, statusReason: string) => {
    const ad = await this.adsModel.findById(adId);
    if (!ad) throw new CastcleException('AD_NOT_FOUND');
    if (![AdsStatus.Approved, AdsStatus.Processing].includes(ad.status)) {
      throw new CastcleException('ACTION_CANNOT_BE_COMPLETED');
    }

    const userOwner = await this.repository.findUser({
      _id: ad.owner as any,
    });

    const accountOwner = await this.repository.findAccount({
      _id: userOwner.ownerAccount as any,
    });

    await this.notificationService.notifyToUser(
      {
        source:
          userOwner.type === UserType.PEOPLE
            ? NotificationSource.Profile
            : NotificationSource.Page,
        sourceUserId: undefined,
        type: NotificationType.AdsDecline,
        advertiseId: ad._id,
        account: userOwner.ownerAccount,
        read: false,
      },
      userOwner,
      accountOwner?.preferences?.languages[0] || LocalizationLang.English,
    );

    await ad.set({ status: AdsStatus.Declined, statusReason }).save();
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
            contentId: new Types.ObjectId(
              (item.payload as ContentPayloadItem).id,
            ),
            authorId: new Types.ObjectId(
              (item.payload as ContentPayloadItem).authorId,
            ),
          } as AdsPlacementContent),
      );
    const adsplacement = await this.getAdsPlacementFromAuction(
      contentIds,
      viewerAccountId,
    );
    const campaign = await this.adsModel.findById(adsplacement.campaign);
    let adsItem: FeedItemPayloadItem;
    if (campaign.adsRef.collection === 'content') {
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
        payload: [page.toPublicResponse()],
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

  updateAllAdsStatus = async () => {
    //update daily Spent

    await this.adsModel.updateMany(
      {
        boostStatus: AdsBoostStatus.Running,
      },
      { $set: { 'statistics.dailySpent': new Types.Decimal128('0') } },
    );
  };

  getAdsRef = async (user: User, { castcleId, contentId }: AdsRequestDto) => {
    if (castcleId) {
      const requestUser = await this.repository.findUser({
        castcleId: castcleId,
      });

      if (String(user.ownerAccount) !== String(requestUser.ownerAccount))
        throw new CastcleException('ACTION_CANNOT_BE_COMPLETED');

      return new DBRef('user', new Types.ObjectId(requestUser.id));
    }

    const content = await this.contentModel.findById(contentId);

    if (String(content.author.id) !== user.id)
      throw new CastcleException('ACTION_CANNOT_BE_COMPLETED');

    return new DBRef('content', new Types.ObjectId(contentId));
  };

  createAds = async (user: User, adsRequest: AdsRequestDto) => {
    const [adsRef, validateAds] = await Promise.all([
      this.getAdsRef(user, adsRequest),
      this.validateAds(user, adsRequest),
    ]);

    if (!validateAds) throw new CastcleException('NOT_ENOUGH_BALANCE');

    const adDto = {
      adsRef: adsRef,
      owner: user._id,
      objective: adsRequest.objective,
      detail: <AdsDetail>{
        name: adsRequest.campaignName,
        message: adsRequest.campaignMessage,
        code: this.runningCodeAd(),
        dailyBudget: adsRequest.dailyBudget,
        duration: adsRequest.duration,
        paymentMethod: adsRequest.paymentMethod,
        dailyBidType: adsRequest.dailyBidType,
        dailyBidValue: adsRequest.dailyBidValue,
      },
      statistics: DefaultAdsStatistic,
      status: AdsStatus.Processing,
      boostStatus: AdsBoostStatus.Unknown,
    };

    this.logger.log(JSON.stringify(adDto), 'adDto:createAds');

    const ad = await new this.adsModel(adDto).save();

    return this.lookupAds(user, ad._id);
  };

  getListAds = async (
    { _id, ownerAccount }: User,
    { sinceId, untilId, maxResults, filter, timezone }: AdsQuery,
  ) => {
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
    const ads = await this.adsModel.aggregate([
      { $sort: { createdAt: -1, _id: -1 } },
      { $match: filters },
      { $limit: maxResults },
    ]);

    const AdResponses = await this.convertAdsToAdResponses(ads);

    const users = await this.userModel
      .find({
        _id: AdResponses.map(({ boostType, payload }) =>
          boostType === AdsBoostType.Content
            ? (payload as ContentPayloadItem).authorId
            : payload.id,
        ),
      })
      .exec();

    const includesUsers = users.map((user) =>
      new Author({
        id: user.id,
        avatar: user.profile?.images?.avatar,
        castcleId: user.displayId,
        displayName: user.displayName,
        type: user.type,
        verified: user.verified,
      }).toIncludeUser(),
    );

    return ResponseDto.ok({
      payload: AdResponses,
      includes: new CastcleIncludes({
        users: includesUsers,
      }),
      meta: Meta.fromDocuments(ads),
    });
  };

  lookupAds = async ({ _id, ownerAccount }: User, adsId: string) => {
    const ids = await this._getUserIds(ownerAccount, _id);

    const ad = await this.adsModel.aggregate<Ad>([
      {
        $match: {
          owner: { $in: [...ids, _id] },
          _id: new Types.ObjectId(adsId),
        },
      },
    ]);

    if (!ad.length) throw new CastcleException('AD_NOT_FOUND');

    const [AdResponse] = await this.convertAdsToAdResponses(ad);

    const user = await this.userModel
      .findOne({
        _id:
          AdResponse.boostType === AdsBoostType.Content
            ? (AdResponse.payload as ContentPayloadItem).authorId
            : AdResponse.payload.id,
      })
      .exec();

    const includesUsers = new Author({
      id: user.id,
      avatar: user.profile?.images?.avatar,
      castcleId: user.displayId,
      displayName: user.displayName,
      type: user.type,
      verified: user.verified,
    }).toIncludeUser();

    return {
      ...AdResponse,
      includes: new CastcleIncludes({
        users: [includesUsers],
      }),
    };
  };

  updateAdsById = async (adsId: string, adsRequest: AdsRequestDto) => {
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
  };

  deleteAdsById = async (adsId: string) => {
    const ad = await this.adsModel.findOne({
      _id: adsId,
    });
    if (!ad) throw new CastcleException('AD_NOT_FOUND');

    if (ad.status !== AdsStatus.Processing)
      throw new CastcleException('AD_RUNNING_CAN_NOT_DELETE');

    await ad.remove();
  };

  updateAdsBoostStatus = async (
    adsId: string,
    adsBoostStatus: AdsBoostStatus,
  ) => {
    return this.adsModel.updateOne(
      { _id: adsId, status: AdsStatus.Approved },
      {
        $set: {
          boostStatus: adsBoostStatus,
        },
      },
    );
  };

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
              user: adsCampaign.owner._id,
              type:
                adsCampaign.detail.paymentMethod === AdsPaymentMethod.ADS_CREDIT
                  ? WalletType.ADS
                  : WalletType.PERSONAL,
              value: Types.Decimal128.fromString(estAdsCostCAST.toString()),
            },
            to: [
              {
                type: WalletType.CASTCLE_SOCIAL,
                value: Types.Decimal128.fromString(estAdsCostCAST.toString()),
              },
            ],
            ledgers: [
              {
                debit: {
                  cAccountNo:
                    adsCampaign.detail.paymentMethod ===
                    AdsPaymentMethod.ADS_CREDIT
                      ? CAccountNo.LIABILITY.USER_WALLET.ADS
                      : CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
                  value: estAdsCostCAST,
                },
                credit: {
                  cAccountNo:
                    adsCampaign.detail.paymentMethod ===
                    AdsPaymentMethod.ADS_CREDIT
                      ? CAccountNo.SOCIAL_REWARD.ADS_CREDIT.NO
                      : CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
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
          //if balance < 1 CAST Then pause ads
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
        adsplacement.markModified('cost');
        await adsplacement.save();
      });
      await session.endSession();
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
          value: Types.Decimal128.fromString(reward.viewerShare.toString()),
        },
        to: [
          {
            user: adsplacement.user._id,
            type: WalletType.PERSONAL,
            value: Types.Decimal128.fromString(reward.viewerShare.toString()),
          },
        ],
        ledgers: [
          {
            debit: {
              cAccountNo:
                adsplacement.campaign.campaignPaymentType ===
                AdsPaymentMethod.ADS_CREDIT
                  ? CAccountNo.SOCIAL_REWARD.ADS_CREDIT.NO
                  : CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
              value: reward.viewerShare,
            },
            credit: {
              cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
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
    const transferTo: MicroTransaction[] = [];
    const ledgers: TLedger[] = [];
    const rewardPerContent = Types.Decimal128.fromString(
      (reward.creatorShare / adsplacement.contents.length).toString(),
    );

    for (let i = 0; i < adsplacement.contents.length; i++) {
      transferTo.push({
        user: adsplacement.contents[i].authorId,
        type: WalletType.PERSONAL,
        value: rewardPerContent,
      });
      ledgers.push({
        debit: {
          cAccountNo:
            adsplacement.campaign.campaignPaymentType ===
            AdsPaymentMethod.ADS_CREDIT
              ? CAccountNo.SOCIAL_REWARD.ADS_CREDIT.NO
              : CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
          value: rewardPerContent,
        },
        credit: {
          cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
          value: rewardPerContent,
        },
      });
    }
    return this.tAccountService.transfer(
      {
        from: {
          type: WalletType.CASTCLE_SOCIAL,
          value: Types.Decimal128.fromString(reward.creatorShare.toString()),
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
        (c) => c.content === adsplacement.contents[j].contentId,
      );
      if (currentCfs.length > 0) {
        const transferTo: MicroTransaction[] = [];
        const ledgers: TLedger[] = [];
        for (let i = 0; i < currentCfs.length; i++) {
          const rewardContent = Types.Decimal128.fromString(
            (
              currentCfs[i].weight *
              (reward.farmingShare /
                (reward.farmingShare + reward.creatorShare)) *
              creatorRewardPerContent
            ).toString(),
          );
          transferTo.push({
            user: currentCfs[i].user,
            type: WalletType.PERSONAL,
            value: rewardContent,
          });
          ledgers.push({
            debit: {
              cAccountNo:
                adsplacement.campaign.campaignPaymentType ===
                AdsPaymentMethod.ADS_CREDIT
                  ? CAccountNo.SOCIAL_REWARD.ADS_CREDIT.NO
                  : CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
              value: rewardContent,
            },
            credit: {
              cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
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
              value: Types.Decimal128.fromString(
                reward.farmingShare.toString(),
              ),
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
              value: Types.Decimal128.fromString(
                creatorRewardPerContent.toString(),
              ),
            },
            to: [
              {
                type: WalletType.PERSONAL,
                value: Types.Decimal128.fromString(
                  creatorRewardPerContent.toString(),
                ),
                user: adsplacement.contents[j].authorId,
              },
            ],
            ledgers: [
              {
                debit: {
                  cAccountNo:
                    adsplacement.campaign.campaignPaymentType ===
                    AdsPaymentMethod.ADS_CREDIT
                      ? CAccountNo.SOCIAL_REWARD.ADS_CREDIT.NO
                      : CAccountNo.SOCIAL_REWARD.PERSONAL.NO,
                  value: creatorRewardPerContent,
                },
                credit: {
                  cAccountNo: CAccountNo.LIABILITY.USER_WALLET.PERSONAL,
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

  adsRunning = async (ad: Ad) => {
    this.logger.log(ad.startAt.toISOString(), 'adsRunning:startAt');
    this.logger.log(
      ad.pauseInterval[ad.pauseInterval.length - 1].pause.toISOString(),
      'adsRunning:pauseInterval',
    );

    const pauseDate = ad.pauseInterval[ad.pauseInterval.length - 1].pause;

    const diff = DateTime.local().diff(
      DateTime.fromJSDate(pauseDate),
      'milliseconds',
    ).milliseconds;

    const newEndedAt = DateTime.fromJSDate(ad.endedAt)
      .plus({ milliseconds: diff })
      .toJSDate();

    await this.adsModel.updateOne(
      { _id: ad._id, 'pauseInterval.pause': pauseDate },
      {
        $set: {
          endedAt: newEndedAt,
          boostStatus: AdsBoostStatus.Running,
          'pauseInterval.$.resume': new Date(),
        },
      },
    );
  };

  adsPause = async (ad: Ad) => {
    await this.adsModel.updateOne(
      { _id: ad._id },
      {
        $set: { boostStatus: AdsBoostStatus.Pause },
        $push: {
          pauseInterval: {
            pause: new Date(),
          },
        },
      },
    );
  };
}
