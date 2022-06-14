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

import {
  TransformStringToArrayOfStrings,
  TransformStringToKeyword,
} from '@castcle-api/utils/commons';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
} from 'class-validator';
import { ExcludeType, KeywordType } from '../models';
import { OwnerResponse, PublicUserResponse } from './user.dto';

export class GetTopTrendQuery {
  @IsOptional()
  @IsNumberString()
  limit?: number = 10;

  @IsOptional()
  @TransformStringToArrayOfStrings()
  @IsEnum(ExcludeType, { each: true })
  exclude?: string[];
}

export class GetByQuery {
  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsNotEmpty()
  @TransformStringToKeyword()
  keyword: {
    input: string;
    type: KeywordType;
  };
}

export class HashtagResponseDto {
  rank: number;

  id: string;

  slug: string;

  name: string;

  count: number;
}

export class TopTrendsResponseDto {
  hashtags: HashtagResponseDto[];
  users: (PublicUserResponse | OwnerResponse)[];
}

export class PayloadHashtagOption {
  key: string;
  isTrending: boolean;
}

export class ByKeywordResponseDto {
  keyword: {
    text: string;
    isTrending: boolean;
  }[];
  hashtags: HashtagResponseDto[];
  users: (PublicUserResponse | OwnerResponse)[];
}
