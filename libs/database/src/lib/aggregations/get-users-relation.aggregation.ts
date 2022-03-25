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
import * as mongoose from 'mongoose';
import { Types } from 'mongoose';
import { EntityVisibility, QueryOption, SortBy } from '../dtos';
import { Relationship, User } from '../schemas';

export class GetUserRelationParams {
  userId: Types.ObjectId;
  limit: number;
  keyword?: string;
  sinceId?: string;
  untilId?: string;
  userType?: string;
  sortBy?: SortBy;
}

export type GetUserRelationResponse = Relationship & {
  user_relation: User[];
};

export type GetUserRelationResponseCount = {
  total: number;
};

export const pipelineOfUserRelationMentions = (
  params: GetUserRelationParams
) => {
  return [
    {
      $match: {
        user: params.userId,
        $or: [{ isFollowPage: true }, { following: true }],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'followedUser',
        foreignField: '_id',
        pipeline: [
          { $sort: { updatedAt: -1 } },
          {
            $match: {
              displayId: {
                $regex: new RegExp('^' + params.keyword.toLowerCase(), 'i'),
              },
              visibility: EntityVisibility.Publish,
            },
          },
        ],
        as: 'user_relation',
      },
    },
    { $limit: params.limit },
  ];
};

const filterId = (queryOption: QueryOption) => {
  if (queryOption.sinceId) {
    return {
      _id: {
        $gt: mongoose.Types.ObjectId(queryOption.sinceId),
      },
    };
  } else if (queryOption.untilId) {
    return {
      _id: {
        $lt: mongoose.Types.ObjectId(queryOption.untilId),
      },
    };
  }
};

const sorting = (sortBy?: SortBy) => {
  const direction = sortBy?.type === 'asc' ? 1 : -1;
  return {
    [sortBy?.field]: direction,
    _id: direction,
  };
};

const filterType = (userType?: string) => {
  if (userType)
    return {
      'user_relation.type': userType,
    };
};

const userFollowQuery = (params: GetUserRelationParams) => {
  return [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user_relation',
      },
    },
    {
      $match: {
        followedUser: params.userId,
        visibility: EntityVisibility.Publish,
        following: true,
        'user_relation.visibility': EntityVisibility.Publish,
        ...filterType(params.userType),
        ...filterId({
          sinceId: params.sinceId,
          untilId: params.untilId,
        }),
      },
    },
    { $sort: sorting(params.sortBy) },
  ];
};

export const pipelineOfUserRelationFollowers = (
  params: GetUserRelationParams
) => {
  return [...userFollowQuery(params), ...[{ $limit: params.limit }]];
};

export const pipelineOfUserRelationFollowersCount = (
  params: GetUserRelationParams
) => {
  return [
    ...userFollowQuery(params),
    ...[
      {
        $count: 'total',
      },
    ],
  ];
};

const userFollowingQuery = (params: GetUserRelationParams) => {
  return [
    {
      $lookup: {
        from: 'users',
        localField: 'followedUser',
        foreignField: '_id',
        as: 'user_relation',
      },
    },
    {
      $match: {
        user: params.userId,
        visibility: EntityVisibility.Publish,
        following: true,
        'user_relation.visibility': EntityVisibility.Publish,
        ...filterType(params.userType),
        ...filterId({
          sinceId: params.sinceId,
          untilId: params.untilId,
        }),
      },
    },
    { $sort: sorting(params.sortBy) },
  ];
};

export const pipelineOfUserRelationFollowing = (
  params: GetUserRelationParams
) => {
  return [...userFollowingQuery(params), ...[{ $limit: params.limit }]];
};

export const pipelineOfUserRelationFollowingCount = (
  params: GetUserRelationParams
) => {
  return [
    ...userFollowingQuery(params),
    ...[
      {
        $count: 'total',
      },
    ],
  ];
};
