/*
 * Filename: /Users/sompop/Projects/castcle-api/libs/database/src/lib/models/ads.model.tts
 * Path: /Users/sompop/Projects/castcle-api
 * Created Date: Wednesday, February 9th 2022, 10:19:41 am
 * Author: Sompop Kulapalanont
 *
 * Copyright (c) 2022 Your Company
 */

export class AdsCost {
  CAST: number;
  UST: number;
}

export enum AdsPaymentMethod {
  ADS_CREDIT = 'ads-credit',
  TOKEN_WALLET = 'token-wallet',
  CREDIT_CARD = 'credit-card',
}

export class AdsSocialReward {
  adsCost: number;
  castcleShare: number;
  viewerShare: number;
  creatorShare: number;
  farmingShare: number;

  constructor(paymentType: AdsPaymentMethod, cost: AdsCost) {
    switch (paymentType) {
      case AdsPaymentMethod.ADS_CREDIT:
        this.adsCost = cost.CAST;
        this.castcleShare = 0;
        this.creatorShare = 0.5 * cost.CAST;
        this.farmingShare = 0.3 * cost.CAST;
        this.viewerShare = 0.2 * cost.CAST;
        break;
      default:
        this.adsCost = cost.CAST;
        this.castcleShare = 0.3 * cost.CAST;
        this.creatorShare = 0.35 * cost.CAST;
        this.farmingShare = 0.21 * cost.CAST;
        this.viewerShare = 0.14 * cost.CAST;
    }
  }
}

export type AdsPlacementContent = {
  contentId: string;
  authorId: string;
};

export type AdsPlacementCampaign = {
  campaignId: string;
  campaignPaymentType: AdsPaymentMethod;
};

export type AdsCpm = {
  cpm?: number;
  biddingCpm?: number;
  relevanceScore?: number;
  rankingScore?: number;
  adsCampaignId?: string;
};
