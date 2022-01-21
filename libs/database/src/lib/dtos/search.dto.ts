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
import { CastcleImage } from './common.dto';

export class TopTrendsQueryOptions {
  exclude?: string = '';
  limit?: number = 10;
}

export const DEFAULT_TOP_TREND_QUERY_OPTIONS = {
  limit: 10,
  exclude: '',
} as TopTrendsQueryOptions;

export class SearchHashtagResponseDto {
  @ApiProperty()
  rank: number;

  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  count: number;

  @ApiProperty()
  trends: string;

  @ApiProperty()
  isTrending: boolean;
}

export class AggregatorSearchResponseDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  count: number;
}

export class SearchFollowsResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  castcleId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  overview: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  avatar: CastcleImage;

  @ApiProperty()
  aggregator: AggregatorSearchResponseDto;

  @ApiProperty()
  verified: boolean;

  @ApiProperty()
  count: number;

  @ApiProperty()
  followed: boolean;
}

export class TopTrendsResponse {
  @ApiProperty({ type: SearchHashtagResponseDto, isArray: true })
  hashtags: SearchHashtagResponseDto[];
  @ApiProperty({ type: SearchFollowsResponseDto, isArray: true })
  follows: SearchFollowsResponseDto[];
  @ApiProperty()
  topics: [];
}

export class SearchKeywordResponseDto {
  @ApiProperty()
  text: string;

  @ApiProperty()
  isTrending: boolean;
}

export class SearchResponse {
  @ApiProperty({ type: SearchKeywordResponseDto, isArray: true })
  keyword: SearchKeywordResponseDto[];
  @ApiProperty({ type: SearchHashtagResponseDto, isArray: true })
  hashtags: SearchHashtagResponseDto[];
  @ApiProperty({ type: SearchFollowsResponseDto, isArray: true })
  follows: SearchFollowsResponseDto[];
}
