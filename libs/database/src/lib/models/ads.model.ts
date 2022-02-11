/*
 * Filename: /Users/sompop/Projects/castcle-api/libs/database/src/lib/models/ads.model.tts
 * Path: /Users/sompop/Projects/castcle-api
 * Created Date: Wednesday, February 9th 2022, 10:19:41 am
 * Author: Sompop Kulapalanont
 *
 * Copyright (c) 2022 Your Company
 */

export enum AdsObjective {
  Engagement = 'engagement',
  Reach = 'reach',
}

export enum AdsStatus {
  Processing = 'processing',
  Declinded = 'declinded',
  Approved = 'approved',
}

export enum AdsBoostStatus {
  Unknown = 'unknown',
  Running = 'running',
  Pause = 'pause',
  End = 'end',
}

export class AdsCost {
  CAST: number;
  USDC: number;
}
