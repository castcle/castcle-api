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
import { TransactionStatus } from '../models';

export class WalletBalanceResponse {
  ads: Types.Decimal128;
  farm: Types.Decimal128;
  personal: Types.Decimal128;
  others: Types.Decimal128;
  total: Types.Decimal128;
}

export const pipelineOfWalletBalance = (userId: Types.ObjectId) => [
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
      status: { $ne: TransactionStatus.FAILED },
    },
  },
  {
    $facet: {
      inflows: [
        {
          $match: {
            'to.user': userId,
          },
        },
        {
          $project: {
            to: {
              $reduce: {
                input: '$to',
                initialValue: {
                  ads: 0,
                  farm: 0,
                  personal: 0,
                  others: 0,
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
                        },
                      },
                      {
                        case: {
                          $eq: ['$$this.type', 'farm.lock'],
                        },
                        then: {
                          farm: {
                            $add: ['$$value.farm', '$$this.value'],
                          },
                        },
                      },
                      {
                        case: {
                          $eq: ['$$this.type', 'personal'],
                        },
                        then: {
                          personal: {
                            $add: ['$$value.personal', '$$this.value'],
                          },
                        },
                      },
                    ],
                    default: {
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
                      $ne: ['$from.user', userId],
                    },
                    then: 0,
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
                      $eq: ['$from.type', 'farm.lock'],
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
            $sum: '$outflows.to.ads',
          },
        ],
      },
      farm: {
        $subtract: [
          {
            $sum: '$inflows.to.farm',
          },
          {
            $sum: '$outflows.to.farm',
          },
        ],
      },
      personal: {
        $subtract: [
          {
            $sum: '$inflows.to.personal',
          },
          {
            $sum: '$outflows.to.personal',
          },
        ],
      },
      others: {
        $subtract: [
          {
            $sum: '$inflows.to.others',
          },
          {
            $sum: '$outflows.to.others',
          },
        ],
      },
    },
  },
  {
    $addFields: {
      total: {
        $sum: ['$ads', '$farm', '$personal', '$others'],
      },
    },
  },
];
