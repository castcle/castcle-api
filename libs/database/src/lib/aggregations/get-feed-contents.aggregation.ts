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

export class GetFeedContentsResponse {
  _id: Types.ObjectId;
  ownerAccount: Types.ObjectId;
  displayId: string;
  followingContents: Types.ObjectId[];
  globalContents: Types.ObjectId[];
}

export class GetFeedContentsParams {
  decayDays: number;
  followFeedMax: number;
  followFeedRatio: number;
  duplicateContentMax: number;
  geolocation?: string;
  maxResult: number;
  preferLanguages: string[];
  userId: Types.ObjectId;
  calledAtDelay: number;
}

export const pipelineOfGetFeedContents = (params: GetFeedContentsParams) => {
  return [
    {
      $match: {
        _id: params.userId,
      },
    },
    {
      $lookup: {
        from: 'relationships',
        localField: '_id',
        foreignField: 'user',
        pipeline: [
          { $sort: { updatedAt: -1 } },
          {
            $match: {
              blocked: { $ne: true },
              blocking: { $ne: true },
              $or: [{ isFollowPage: true }, { following: true }],
            },
          },
          { $project: { _id: 0, followedUser: 1 } },
        ],
        as: 'followings',
      },
    },
    {
      $lookup: {
        from: 'relationships',
        localField: '_id',
        foreignField: 'user',
        pipeline: [
          { $sort: { updatedAt: -1 } },
          {
            $match: {
              $or: [{ blocked: true }, { blocking: true }],
            },
          },
          { $project: { _id: 0, followedUser: 1 } },
        ],
        as: 'blockings',
      },
    },
    {
      $lookup: {
        from: 'feeditems',
        localField: 'ownerAccount',
        foreignField: 'viewer',
        let: {
          dateNow: new Date(),
          dateDiff: new Date(
            new Date().getTime() - params.decayDays * 1000 * 86400
          ),
          calledDiff: new Date(
            new Date().getTime() - params.calledAtDelay * 1000
          ),
        },
        pipeline: [
          { $sort: { createdAt: -1 } },
          {
            $match: {
              $expr: {
                $or: [
                  {
                    $and: [
                      { $lte: ['$seenAt', '$$dateNow'] },
                      { $gte: ['$seenAt', '$$dateDiff'] },
                    ],
                  },
                  {
                    $gte: ['$calledAt', '$$calledDiff'],
                  },
                ],
              },
            },
          },
          { $project: { _id: 0, content: 1 } },
        ],
        as: 'duplicateContents',
      },
    },
    {
      $lookup: {
        from: 'guestfeeditems',
        let: {
          duplicateContents: '$duplicateContents',
          dateNow: new Date(),
          dateDiff: new Date(
            new Date().getTime() - params.decayDays * 1000 * 86400
          ),
        },
        pipeline: [
          { $sort: { score: -1 } },
          {
            $match: {
              $expr: {
                $and: [
                  params.geolocation
                    ? { $eq: ['$countryCode', params.geolocation] }
                    : {},
                  {
                    $and: [
                      { $lte: ['$createdAt', '$$dateNow'] },
                      { $gte: ['$createdAt', '$$dateDiff'] },
                    ],
                  },
                  {
                    $not: { $in: ['$content', '$$duplicateContents.content'] },
                  },
                ],
              },
            },
          },
          {
            $lookup: {
              from: 'contentinfo',
              localField: 'content',
              foreignField: 'contentId',
              as: 'info',
            },
          },
          {
            $project: {
              _id: 0,
              content: 1,
              localized: {
                $setIsSubset: ['$info.language', params.preferLanguages],
              },
            },
          },
          {
            $sort: { localized: -1 },
          },
          {
            $limit: Math.ceil(params.maxResult * (1 - params.followFeedRatio)),
          },
        ],
        as: 'globalContents',
      },
    },
    {
      $lookup: {
        from: 'contents',
        let: {
          blockings: '$blockings',
          followings: '$followings',
          globalContents: '$globalContents',
          duplicateContents: '$duplicateContents',
          dateNow: new Date(),
          dateDiff: new Date(
            new Date().getTime() - params.decayDays * 1000 * 86400
          ),
        },
        pipeline: [
          { $sort: { createdAt: -1 } },
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$author.id', '$$followings.followedUser'] },
                  {
                    $and: [
                      { $lte: ['$createdAt', '$$dateNow'] },
                      { $gte: ['$createdAt', '$$dateDiff'] },
                    ],
                  },
                  { $not: { $in: ['$_id', '$$globalContents.content'] } },
                  { $not: { $in: ['$author.id', '$$blockings.followedUser'] } },
                  {
                    $not: { $in: ['$_id', '$$duplicateContents.content'] },
                  },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
          { $limit: Math.ceil(params.maxResult * params.followFeedRatio) },
        ],
        as: 'followingContents',
      },
    },
    {
      $project: {
        _id: 1,
        ownerAccount: 1,
        displayId: 1,
        followingContents: '$followingContents._id',
        globalContents: '$globalContents.content',
      },
    },
  ];
};
