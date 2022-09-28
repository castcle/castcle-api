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

import { Types } from 'mongoose';

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
  contentId: Types.ObjectId;
  authorId: Types.ObjectId;
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

export type PauseInterval = {
  pause: Date;
  resume?: Date;
};
