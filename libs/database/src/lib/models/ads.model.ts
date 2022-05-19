/*
 * Filename: /Users/sompop/Projects/castcle-api/libs/database/src/lib/models/ads.model.tts
 * Path: /Users/sompop/Projects/castcle-api
 * Created Date: Wednesday, February 9th 2022, 10:19:41 am
 * Author: Sompop Kulapalanont
 *
 * Copyright (c) 2022 Your Company
 */

import { AdsCampaign } from "../schemas";

export class AdsCost {
  CAST: number;
  UST: number;
}

export enum AdsPaymentMethod {
  ADS_CREDIT = 'ads-credit',
  TOKEN_WALLET = 'token-wallet',
  CREDIT_CARD = 'credit-card',
}

export type AdsCpm  ={
  cpm?:number;
  bidding_cpm?:number;
  relevance_score?:number;
  ranking_score?:number;
  adsCampignId?:string;
}