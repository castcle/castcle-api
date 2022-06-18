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

import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { AdsBidType, AdsObjective, FilterInterval } from '../models';
import { AdsCampaign } from '../schemas';
import { ContentPayloadItem } from './content.dto';
import { PaginationQuery } from './pagination.dto';
import { PageResponseDto } from './user.dto';

export class AdsAuctionAggregateDto {
  campaign: AdsCampaign;
  auctionPrice: number; // auction price in USDC
}

export class AdsRequestDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  campaignName: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  campaignMessage: string;

  @IsEnum([AdsObjective.Engagement, AdsObjective.Reach])
  @IsNotEmpty()
  @ApiProperty()
  objective: AdsObjective;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  dailyBudget: number;

  @IsEnum([AdsBidType.Auto, AdsBidType.CostPerAccount])
  @IsNotEmpty()
  @ApiProperty()
  dailyBidType: AdsBidType;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  dailyBidValue?: number;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  duration: number;

  @IsString()
  @ApiProperty()
  @IsOptional()
  contentId?: string;

  @IsString()
  @ApiProperty()
  @IsOptional()
  paymentMethod: string;

  @ApiProperty()
  @IsOptional()
  castcleId?: string;
}

export class AdsCampaignResponseDto {
  'campaignName': string;
  'campaignMessage': string;
  'campaignCode': string;
  'objective': string;
  'dailyBudget': number;
  'dailyBidType': AdsBidType;
  'dailyBidValue': number;
  'duration': number;
  'adStatus': string;
  'boostStatus': string;
  'boostType': 'page' | 'content';
  'payload': ContentPayloadItem | PageResponseDto;
  'statistics': AdsCampaignStatisticResponse;
  'engagement': any;
  'createdAt': Date;
  'updatedAt': Date;
}

export class AdsCampaignStatisticResponse {
  'budgetSpent': number;
  'dailySpent': number;
  'impression': {
    organic: number;
    paid: number;
  };
  'reach': {
    organic: number;
    paid: number;
  };
  'CPM': number;
}
export class AdsQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(FilterInterval)
  filter?: FilterInterval;
  @IsOptional()
  @IsString()
  timezone = '+00:00';
}
