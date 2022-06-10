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

import { DEFAULT_CONTENT_QUERY_OPTIONS, EntityVisibility } from '../dtos';
import { EngagementType } from '../models';
import { User } from '../schemas';

type GetContentFilter = {
  [key: string]: string;
};

type GetContentsQuery = {
  filter?: GetContentFilter;
  maxResults?: number;
  viewer?: User;
  sortBy?: {
    [key: string]: string;
  };
};
export const pipelineGetContents = (query: GetContentsQuery) => {
  return [
    {
      $sort: query.sortBy || {
        createdAt: -1,
      },
    },
    {
      $match: query.filter,
    },
    {
      $limit: query.maxResults || DEFAULT_CONTENT_QUERY_OPTIONS.maxResults,
    },
    {
      $facet: {
        contents: [
          {
            $sort: query.sortBy || {
              createdAt: -1,
            },
          },
        ],
        casts: [
          {
            $group: {
              _id: '$originalPost._id',
              contentId: { $addToSet: '$originalPost._id' },
            },
          },
          {
            $lookup: {
              from: 'contents',
              let: { originalPostId: '$contentId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $in: ['$_id', '$$originalPostId'],
                    },
                  },
                },
              ],
              as: 'casts',
            },
          },
          {
            $unwind: {
              path: '$casts',
            },
          },
          {
            $replaceRoot: {
              newRoot: '$casts',
            },
          },
        ],
        authors: [
          {
            $lookup: {
              from: 'users',
              localField: 'author.id',
              foreignField: '_id',
              as: 'author',
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'originalPost.author.id',
              foreignField: '_id',
              as: 'originalAuthor',
            },
          },
          {
            $group: {
              _id: null,
              authors: { $addToSet: { $arrayElemAt: ['$author', 0] } },
              originalAuthors: {
                $addToSet: {
                  $cond: {
                    if: { $gt: [{ $size: '$originalAuthor' }, 0] },
                    then: { $arrayElemAt: ['$originalAuthor', 0] },
                    else: '$$REMOVE',
                  },
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              authors: { $concatArrays: ['$authors', '$originalAuthors'] },
            },
          },
          { $unwind: '$authors' },
          { $replaceWith: '$authors' },
          {
            $project: {
              id: '$_id',
              avatar: '$profile.images.avatar',
              castcleId: '$displayId',
              displayName: '$displayName',
              type: '$type',
              verified: '$verified',
            },
          },
        ],
        metrics: [
          {
            $lookup: {
              from: 'engagements',
              let: { contentId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$targetRef.$ref', 'content'] },
                        { $eq: ['$targetRef.$id', '$$contentId'] },
                        { $eq: ['$visibility', EntityVisibility.Publish] },
                      ],
                    },
                  },
                },
                {
                  $group: {
                    _id: '$targetRef.$id',
                    likeCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', EngagementType.Like] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    commentCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', EngagementType.Comment] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    quoteCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', EngagementType.Quote] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    recastCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', EngagementType.Recast] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                  },
                },
              ],
              as: 'metrics',
            },
          },
          {
            $unwind: {
              path: '$metrics',
            },
          },
          {
            $replaceRoot: { newRoot: '$metrics' },
          },
        ],
        metricsOriginal: [
          {
            $lookup: {
              from: 'engagements',
              let: { contentId: '$originalPost._id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$targetRef.$ref', 'content'] },
                        { $eq: ['$targetRef.$id', '$$contentId'] },
                      ],
                    },
                  },
                },
                {
                  $group: {
                    _id: '$targetRef.$id',
                    likeCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', EngagementType.Like] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    commentCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', EngagementType.Comment] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    quoteCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', EngagementType.Quote] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    recastCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', EngagementType.Recast] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                  },
                },
              ],
              as: 'metricsOriginal',
            },
          },
          {
            $unwind: {
              path: '$metricsOriginal',
            },
          },
          {
            $replaceRoot: { newRoot: '$metricsOriginal' },
          },
        ],
        engagements: [
          {
            $lookup: {
              from: 'engagements',
              let: {
                contentId: '$_id',
                userId: query.viewer?._id,
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$targetRef.$ref', 'content'] },
                        { $eq: ['$targetRef.$id', '$$contentId'] },
                        { $eq: ['$user', '$$userId'] },
                        { $eq: ['$visibility', EntityVisibility.Publish] },
                      ],
                    },
                  },
                },
              ],
              as: 'engagements',
            },
          },
          {
            $unwind: {
              path: '$engagements',
            },
          },
          {
            $replaceRoot: { newRoot: '$engagements' },
          },
        ],
        engagementsOriginal: [
          {
            $lookup: {
              from: 'engagements',
              let: {
                contentId: '$originalPost._id',
                userId: query.viewer?._id,
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$targetRef.$ref', 'content'] },
                        { $eq: ['$targetRef.$id', '$$contentId'] },
                        { $eq: ['$user', '$$userId'] },
                        { $eq: ['$visibility', EntityVisibility.Publish] },
                      ],
                    },
                  },
                },
              ],
              as: 'engagementsOriginal',
            },
          },
          {
            $unwind: {
              path: '$engagementsOriginal',
            },
          },
          {
            $replaceRoot: { newRoot: '$engagementsOriginal' },
          },
        ],
      },
    },
  ];
};
