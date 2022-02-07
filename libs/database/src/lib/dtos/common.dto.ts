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

export class Pagination {
  @ApiProperty()
  previous?: number;
  @ApiProperty()
  self?: number;
  @ApiProperty()
  next?: number;
  @ApiProperty()
  limit?: number;
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class SortBy {
  field = 'updatedAt';
  type = SortDirection.DESC;
}

export class CastcleQueryOptions {
  sortBy?: SortBy;
  type?: string;
  page?: number = 1;
  limit?: number = 25;
}

export const DEFAULT_QUERY_OPTIONS = {
  sortBy: {
    field: 'updatedAt',
    type: SortDirection.DESC,
  },
  page: 1,
  limit: 25,
} as CastcleQueryOptions;

export enum EntityVisibility {
  Hidden = 'hidden',
  Publish = 'publish',
  Deleted = 'deleted',
}

export enum CastcleQueueAction {
  Deleting = 'deleting',
  Deleted = 'deleted',
  Restore = 'restore',
  UpdateProfile = 'updateProfile',
  CreateFollowFeedItem = 'craeteFollowFeedItem',
  CreateFeedItemToEveryOne = 'createFeedItemToEveryone',
  CreateFeedItemToGuests = 'createFeedItemToGuests',
}

export class CastcleImage {
  original: string;
  [key: string]: string;
}

export class CastcleMeta {
  'oldestId'?: string;
  'newestId'?: string;
  'resultCount': number;
  'resultTotal'?: number;
}

export class QueryOption {
  mode?: 'current' | 'history';
  hashtag?: string;
  maxResults?: number;
  sinceId?: string;
  untilId?: string;
}

export class CastcleMetric {
  likeCount: number;
  commentCount?: number;
  quoteCount?: number;
  recastCount?: number;
}

export class CastcleParticipate {
  liked: boolean;
  commented?: boolean;
  quoted?: boolean;
  recasted?: boolean;
}
