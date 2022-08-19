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

import { TransactionStatus } from '@castcle-api/database';
import { PipelineStage, Types } from 'mongoose';

enum BalanceType {
  ADS = 'ads',
  FARM = 'farm',
  OTHERS = 'others',
  PERSONAL = 'personal',
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  TOTAL = 'total',
}

export type WalletBalance = Record<BalanceType, Types.Decimal128>;

export const pipelineOfGetWalletBalance = (
  userId: Types.ObjectId,
): PipelineStage[] => [
  {
    $match: {
      $or: [
        {
          'from.user': userId,
        },
        {
          'to.user': userId,
        },
      ],
      status: {
        $ne: TransactionStatus.FAILED,
      },
    },
  },
  {
    $facet: {
      inflows: [
        {
          $match: {
            'to.user': userId,
            status: TransactionStatus.VERIFIED,
          },
        },
        {
          $project: {
            to: {
              $reduce: {
                input: '$to',
                initialValue: {
                  ads: {
                    $toDecimal: 0,
                  },
                  farm: {
                    $toDecimal: 0,
                  },
                  personal: {
                    $toDecimal: 0,
                  },
                  others: {
                    $toDecimal: 0,
                  },
                },
                in: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $ne: ['$$this.user', userId],
                        },
                        then: '$$value',
                      },
                      {
                        case: {
                          $eq: ['$$this.type', 'ads'],
                        },
                        then: {
                          ads: {
                            $add: ['$$value.ads', '$$this.value'],
                          },
                          farm: '$$value.farm',
                          others: '$$value.others',
                          personal: '$$value.personal',
                        },
                      },
                      {
                        case: {
                          $eq: ['$$this.type', 'farm.locked'],
                        },
                        then: {
                          ads: '$$value.ads',
                          farm: {
                            $add: ['$$value.farm', '$$this.value'],
                          },
                          others: '$$value.others',
                          personal: '$$value.personal',
                        },
                      },
                      {
                        case: {
                          $eq: ['$$this.type', 'personal'],
                        },
                        then: {
                          ads: '$$value.ads',
                          farm: '$$value.farm',
                          others: '$$value.others',
                          personal: {
                            $add: ['$$value.personal', '$$this.value'],
                          },
                        },
                      },
                    ],
                    default: {
                      ads: '$$value.ads',
                      farm: '$$value.farm',
                      personal: '$$value.personal',
                      others: {
                        $add: ['$$value.others', '$$this.value'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
      outflows: [
        {
          $match: {
            'from.user': userId,
          },
        },
        {
          $project: {
            from: {
              $switch: {
                branches: [
                  {
                    case: {
                      $ne: ['$status', TransactionStatus.VERIFIED],
                    },
                    then: {
                      unavailable: '$from.value',
                    },
                  },
                  {
                    case: {
                      $eq: ['$from.type', 'ads'],
                    },
                    then: {
                      ads: '$from.value',
                    },
                  },
                  {
                    case: {
                      $eq: ['$from.type', 'farm.locked'],
                    },
                    then: {
                      farm: '$from.value',
                    },
                  },
                  {
                    case: {
                      $eq: ['$from.type', 'personal'],
                    },
                    then: {
                      personal: '$from.value',
                    },
                  },
                ],
                default: {
                  others: '$from.value',
                },
              },
            },
          },
        },
      ],
    },
  },
  {
    $project: {
      ads: {
        $subtract: [
          {
            $sum: '$inflows.to.ads',
          },
          {
            $sum: '$outflows.from.ads',
          },
        ],
      },
      farm: {
        $subtract: [
          {
            $sum: '$inflows.to.farm',
          },
          {
            $sum: '$outflows.from.farm',
          },
        ],
      },
      personal: {
        $subtract: [
          {
            $sum: '$inflows.to.personal',
          },
          {
            $sum: '$outflows.from.personal',
          },
        ],
      },
      others: {
        $subtract: [
          {
            $sum: '$inflows.to.others',
          },
          {
            $sum: '$outflows.from.others',
          },
        ],
      },
      unavailable: { $sum: '$outflows.from.unavailable' },
    },
  },
  {
    $addFields: {
      available: {
        $subtract: [{ $sum: ['$ads', '$personal', '$others'] }, '$unavailable'],
      },
      total: {
        $sum: ['$ads', '$farm', '$personal', '$others'],
      },
    },
  },
];
