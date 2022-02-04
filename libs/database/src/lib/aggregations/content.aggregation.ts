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

export class ContentAggregator {
  createTime?: Date;
  following?: boolean;
  fromGlobal?: boolean;
}

export type ContentAggregatorParams = {
  userId: mongoose.Types.ObjectId;
  MaxResult: number;
  FollowFeedMax: number;
  FollowFeedRatio: number;
  FollowRecalledMinutes: number;
};

export const pipe2ContentFeedAggregator = (params: ContentAggregatorParams) => {
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
          {
            $sort: {
              updatedAt: -1,
            },
          },
          {
            $limit: params.FollowFeedMax,
          },
        ],
        as: 'following',
      },
    },
    {
      $unwind: {
        path: '$following',
      },
    },
    {
      $project: {
        _id: 1,
        ownerAccount: 1,
        displayId: 1,
        following: '$following.followedUser',
      },
    },
    {
      $lookup: {
        from: 'contents',
        let: {
          content_id: '$_id',
          author_id: '$author.id',
        },
        localField: 'following',
        foreignField: 'author.id',
        pipeline: [
          {
            $sort: {
              createdAt: -1,
            },
          },
          {
            $limit: Math.round(params.MaxResult / (1 - params.FollowFeedRatio)),
          },
        ],
        as: 'contents',
      },
    },
    {
      $unwind: {
        path: '$contents',
      },
    },
    {
      $group: {
        _id: '$_id',
        ownerAccount: {
          $first: '$ownerAccount',
        },
        displayId: {
          $first: '$displayId',
        },
        content_following: {
          $push: '$contents._id',
        },
      },
    },
    {
      $lookup: {
        from: 'guestfeeditems',
        let: {
          countryCode: '$countryCode',
        },
        pipeline: [
          {
            $sort: {
              score: -1,
            },
          },
          {
            $match: {
              $expr: {
                $eq: ['$countryCode', 'th'],
              },
            },
          },
          {
            $limit: params.MaxResult,
          },
        ],
        as: 'contents',
      },
    },
    {
      $unwind: {
        path: '$contents',
      },
    },
    {
      $group: {
        _id: '$_id',
        ownerAccount: {
          $first: '$ownerAccount',
        },
        displayId: {
          $first: '$displayId',
        },
        content_following: {
          $first: '$content_following',
        },
        content_global: {
          $push: '$contents._id',
        },
      },
    },
    {
      $project: {
        ownerAccount: 1,
        displayId: 1,
        contents: {
          $concatArrays: ['$content_following', '$content_global'],
        },
        count: {
          $size: {
            $concatArrays: ['$content_following', '$content_global'],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'feeditems',
        let: {
          content_array: '$contents',
          viewer_id: '$ownerAccount',
        },
        pipeline: [
          {
            $match: {
              calledAt: {
                $exists: true,
              },
              $expr: {
                $or: [
                  {
                    $and: [
                      {
                        $in: ['$content', '$$content_array'],
                      },
                      {
                        $eq: ['$viewer', '$$viewer_id'],
                      },
                      {
                        $lt: [
                          '$calledAt',
                          new Date(
                            new Date().getTime() -
                              1000 * 60 * params.FollowRecalledMinutes
                          ),
                        ],
                      },
                    ],
                  },
                  {
                    $and: [
                      {
                        $in: ['$content', '$$content_array'],
                      },
                      {
                        $eq: ['$viewer', '$$viewer_id'],
                      },
                      {
                        $gt: ['$seenAt', null],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            $project: {
              _id: 0,
              content: 1,
            },
          },
        ],
        as: 'duplicates_content',
      },
    },
    {
      $unwind: {
        path: '$duplicates_content',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: '$_id',
        ownerAccount: {
          $first: '$ownerAccount',
        },
        displayId: {
          $first: '$displayId',
        },
        contents: {
          $first: '$contents',
        },
        duplicates_content: {
          $push: '$duplicates_content.content',
        },
      },
    },
    {
      $project: {
        ownerAccount: 1,
        displayId: 1,
        contents: {
          $setDifference: ['$contents', '$duplicates_content'],
        },
        count: {
          $size: {
            $setDifference: ['$contents', '$duplicates_content'],
          },
        },
      },
    },
  ];
};
