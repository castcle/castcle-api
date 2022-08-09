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
import { CastcleImage } from '@castcle-api/utils/aws';
import { CastPayload, PublicUserResponse } from '../dtos';
import { ContentFarming } from '../schemas';
import { ContentFarmingStatus } from './content-farming.enum';
import { PublicVerification } from './user.model';

export type ContentFarmingCDF = {
  contentId: string;
  contentFarmings: ContentFarming[];
};

class ContentFarmingUserPayload {
  id: string;
  castcleId: string;
  displayName: string;
  followed: boolean;
  blocking: boolean;
  blocked: boolean;
  avatar: CastcleImage;
  verified: PublicVerification;
}
export class ContentFarmingResponse {
  'id': string;
  'number': number;
  'content'?: CastPayload;
  'balance': {
    farmed: number;
    available: number;
    farming: number;
    total: number;
  } = {
    farmed: 0,
    available: 0,
    farming: 0,
    total: 0,
  };
  includes: {
    users: ContentFarmingUserPayload[];
  };
  'status': string;
  'createdAt'?: Date;
  'updatedAt'?: Date;
  'farmedAt'?: Date;

  constructor(
    contentFarming: ContentFarming,
    currentBalance: number,
    lockedBalance: number,
    farmNo: number,
    user?: PublicUserResponse,
    contentPayload?: CastPayload,
  ) {
    this.id = contentFarming?.id ?? null;
    this.number = farmNo;
    this.content = contentPayload;
    this.balance['available'] = currentBalance;
    this.balance['total'] = currentBalance + lockedBalance;
    this.balance['farming'] = (currentBalance + lockedBalance) * 0.05;
    this.balance['farmed'] =
      contentFarming?.status === ContentFarmingStatus.Farming
        ? lockedBalance
        : 0;
    this.status = contentFarming?.status
      ? contentFarming?.status
      : farmNo < Environment.FARMING_LIMIT ||
        contentFarming?.status !== ContentFarmingStatus.Farming
      ? ContentFarmingStatus.Available
      : ContentFarmingStatus.Limit;
    this.includes = {
      users: user
        ? [
            {
              id: user.id,
              castcleId: user.castcleId,
              displayName: user.displayName,
              avatar: user.images.avatar,
              verified: user.verified,
              followed: user.followed,
              blocked: user.blocked,
              blocking: user.blocking,
            },
          ]
        : [],
    };
    this.createdAt = contentFarming?.createdAt ?? null;
    this.updatedAt = contentFarming?.updatedAt;
    this.farmedAt = contentFarming?.endedAt;
  }
}
