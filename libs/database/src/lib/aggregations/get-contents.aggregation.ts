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

import { User } from '../schemas';

type GetContentFilter = {
  [key: string]: string;
};

type GetContentsQuery = {
  filter: GetContentFilter;
  maxResults: number;
  viewer: User;
};
export const pipelineGetContents = (query: GetContentsQuery) => {
  return [
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $match: query.filter,
    },
    {
      $limit: query.maxResults,
    },
    {
      $facet: {
        contents: [
          {
            $sort: {
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
              as: 'cast',
            },
          },
          { $replaceWith: { $arrayElemAt: ['$cast', 0] } },
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
                          if: { $eq: ['$type', 'like'] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    commentCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', 'comment'] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    quotedCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', 'quoted'] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                    recastedCount: {
                      $sum: {
                        $cond: {
                          if: { $eq: ['$type', 'recasted'] },
                          then: 1,
                          else: 0,
                        },
                      },
                    },
                  },
                },
              ],
              as: 'engagements',
            },
          },
          {
            $match: {
              $expr: { $gt: [{ $size: '$engagements' }, 0] },
            },
          },
          { $replaceWith: { $arrayElemAt: ['$engagements', 0] } },
        ],
        engagements: [
          {
            $lookup: {
              from: 'engagements',
              let: {
                contentId: '$_id',
                userId: query.viewer._id,
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$targetRef.$ref', 'content'] },
                        { $eq: ['$targetRef.$id', '$$contentId'] },
                        { $eq: ['$user', '$$userId'] },
                      ],
                    },
                  },
                },
              ],
              as: 'engagements',
            },
          },
          {
            $match: {
              $expr: { $gt: [{ $size: '$engagements' }, 0] },
            },
          },
          { $replaceWith: { $arrayElemAt: ['$engagements', 0] } },
        ],
      },
    },
  ];
};
