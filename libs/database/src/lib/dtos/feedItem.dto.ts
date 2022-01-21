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
  CastcleQueryOptions,
  ContentPayloadDto,
  Pagination,
  SortDirection
} from '.';

export class FeedItemDto {
  content: ContentPayloadDto;
  viewer: any;
  seen: boolean;
  called: boolean;
  __v?:any
}

export enum FeedItemMode {
  Current = 'current',
  Previous = 'previous'
}

export class CastcleFeedQueryOptions extends CastcleQueryOptions {
  mode: string;
  hashtag?: string;
}

export const DEFAULT_FEED_QUERY_OPTIONS = {
  mode: FeedItemMode.Current,
  sortBy: {
    field: 'updatedAt',
    type: SortDirection.DESC
  },
  page: 1,
  limit: 25
} as CastcleFeedQueryOptions;

export interface FeedItemPayload {
  id: string;
  feature: {
    id: 'feed';
    slug: 'feed';
    name: 'Feed'; // ส่งตาม localize
    key: 'feature.feed'; // for analytics
  };
  circle: {
    id: 'for-you';
    slug: 'forYou';
    name: 'For You'; // ส่งตาม localize
    key: 'circle.forYou'; // for analytics
  };
  aggregator: {
    type: 'createTime'; // friend or following or topic
  };
  type: 'content'; // content or suggestion or reminder or ads
  payload: ContentPayloadDto;
  createdAt: string;
  updatedAt: string;
}

export class FeedsResponse {
  @ApiProperty()
  payload: FeedItemPayload[];

  @ApiProperty()
  pagination: Pagination;
}
