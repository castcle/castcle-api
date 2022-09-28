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

import { Campaign, MicroTransaction } from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { PipelineStage, Types } from 'mongoose';

export type EligibleAccounts = { to: MicroTransaction[] };

export const pipelineOfEstimateContentReach = (
  campaign: Campaign,
  accountId?: Types.ObjectId,
): PipelineStage[] => [
  {
    $match: {
      seenAt: {
        $gte: campaign.startDate,
        $lte: campaign.endDate,
      },
    },
  },
  {
    $facet: {
      total: [
        {
          $group: {
            _id: null,
            views: {
              $count: {},
            },
          },
        },
      ],
      to: [
        ...(accountId ? [{ $match: { viewer: accountId } }] : []),
        {
          $group: {
            _id: '$viewer',
            views: {
              $count: {},
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            let: {
              account: '$_id',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ['$ownerAccount', '$$account'],
                      },
                      {
                        $eq: ['$type', 'people'],
                      },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
              {
                $project: {
                  _id: 1,
                },
              },
            ],
            as: '_id',
          },
        },
      ],
    },
  },
  {
    $project: {
      tx: {
        $reduce: {
          input: {
            $slice: [
              '$to',
              {
                $subtract: [
                  {
                    $size: '$to',
                  },
                  1,
                ],
              },
            ],
          },
          initialValue: {
            remaining: {
              $toDecimal: campaign.rewardBalance,
            },
            rewardPerView: {
              $round: [
                {
                  $divide: [
                    {
                      $toDecimal: campaign.rewardBalance,
                    },
                    {
                      $first: '$total.views',
                    },
                  ],
                },
                Environment.DECIMALS_FLOAT,
              ],
            },
            to: [],
          },
          in: {
            remaining: {
              $subtract: [
                '$$value.remaining',
                {
                  $multiply: ['$$this.views', '$$value.rewardPerView'],
                },
              ],
            },
            rewardPerView: '$$value.rewardPerView',
            to: {
              $concatArrays: [
                '$$value.to',
                [
                  {
                    user: {
                      $first: '$$this._id._id',
                    },
                    type: 'personal',
                    value: {
                      $multiply: ['$$this.views', '$$value.rewardPerView'],
                    },
                  },
                ],
              ],
            },
          },
        },
      },
      lastTo: {
        $first: {
          $last: '$to._id._id',
        },
      },
    },
  },
  {
    $project: {
      to: {
        $cond: {
          if: '$lastTo',
          then: {
            $concatArrays: [
              '$tx.to',
              [
                {
                  user: '$lastTo',
                  type: 'personal',
                  value: '$tx.remaining',
                },
              ],
            ],
          },
          else: [],
        },
      },
    },
  },
];
