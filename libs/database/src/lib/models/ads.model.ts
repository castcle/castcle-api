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

export type AdsSocialReward = {
  adsCost: number;
  castcleShare: number;
  viewerShare: number;
  creatorShare: number;
  farmingShare: number;
};

export type AdsPlacementContent = {
  contentId: string;
  authorId: string;
};

export type AdsPlacementCampaign = {
  campaignId: string;
  campaignPaymentType: AdsPaymentMethod;
};
