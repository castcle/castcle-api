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

import {
  AirdropTransactionData,
  Transaction,
  TransactionStatus,
  UserWalletTypes,
} from '@castcle-api/database';
import { PipelineStage, Types } from 'mongoose';

export type TransactionVerification = {
  isEnoughBalance: boolean;
  isValidChecksum: boolean;
  isValidWalletType: boolean;
};

export const pipelineOfAirdropTransactionVerification = (
  tx: Transaction,
): PipelineStage[] => [
  {
    $facet: {
      campaign: [
        {
          $match: {
            _id: new Types.ObjectId(tx._id),
          },
        },
        {
          $lookup: {
            from: 'campaigns',
            localField: 'data.campaign',
            foreignField: '_id',
            as: 'campaign',
          },
        },
        {
          $project: {
            balance: {
              $first: '$campaign.rewardBalance',
            },
            total: {
              $first: '$campaign.totalRewards',
            },
          },
        },
      ],
      isValid: [
        {
          $match: {
            _id: new Types.ObjectId(tx._id),
          },
        },
        {
          $project: {
            walletType: {
              $reduce: {
                input: '$to',
                initialValue: {
                  $cond: {
                    if: { $in: ['$from.type', UserWalletTypes] },
                    then: { $eq: [{ $type: '$from.user' }, 'objectId'] },
                    else: true,
                  },
                },
                in: {
                  $cond: {
                    if: '$$value',
                    then: {
                      $cond: {
                        if: {
                          $in: ['$$this.type', UserWalletTypes],
                        },
                        then: {
                          $and: [
                            '$$value',
                            { $eq: [{ $type: '$$this.user' }, 'objectId'] },
                          ],
                        },
                        else: '$$value',
                      },
                    },
                    else: '$$value',
                  },
                },
              },
            },
          },
        },
      ],
      transactions: [
        {
          $match: {
            'data.campaign': new Types.ObjectId(
              (tx.data as AirdropTransactionData).campaign,
            ),
            status: { $ne: TransactionStatus.FAILED },
            type: 'airdrop',
          },
        },
        {
          $project: {
            from: '$from.value',
            to: {
              $sum: '$to.value',
            },
          },
        },
      ],
    },
  },
  {
    $project: {
      sumOfFrom: {
        $sum: '$transactions.from',
      },
      sumOfTo: {
        $sum: '$transactions.to',
      },
      campaign: '$campaign',
      campaignBalance: {
        $first: '$campaign.balance',
      },
      campaignTotal: {
        $first: '$campaign.total',
      },
      isValidWalletType: {
        $first: '$isValid.walletType',
      },
    },
  },
  {
    $project: {
      isEnoughBalance: {
        $eq: [
          {
            $sum: ['$campaignBalance', '$sumOfFrom'],
          },
          '$campaignTotal',
        ],
      },
      isValidChecksum: {
        $eq: ['$sumOfFrom', '$sumOfTo'],
      },
      isValidWalletType: 1,
    },
  },
];

export const pipelineOfTransactionVerification = (
  tx: Transaction,
): PipelineStage[] => [
  {
    $facet: {
      isValid: [
        {
          $match: {
            _id: new Types.ObjectId(tx._id),
          },
        },
        {
          $project: {
            from: '$from.value',
            check: {
              $reduce: {
                input: '$to',
                initialValue: {
                  sumOfTo: {
                    $toDecimal: 0,
                  },
                  walletType: {
                    $cond: {
                      if: { $in: ['$from.type', UserWalletTypes] },
                      then: { $eq: [{ $type: '$from.user' }, 'objectId'] },
                      else: true,
                    },
                  },
                },
                in: {
                  sumOfTo: {
                    $add: ['$$value.sumOfTo', '$$this.value'],
                  },
                  walletType: {
                    $cond: {
                      if: '$$value.walletType',
                      then: {
                        $cond: {
                          if: {
                            $in: ['$$this.type', UserWalletTypes],
                          },
                          then: {
                            $and: ['$$value.walletType', '$$this.user'],
                          },
                          else: '$$value.walletType',
                        },
                      },
                      else: '$$value.walletType',
                    },
                  },
                },
              },
            },
          },
        },
      ],
      inflows: [
        {
          $match: {
            'to.user': new Types.ObjectId(tx.from.user),
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
                          $ne: [
                            '$$this.user',
                            new Types.ObjectId(tx.from.user),
                          ],
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
            'from.user': new Types.ObjectId(tx.from.user),
            status: {
              $ne: TransactionStatus.FAILED,
            },
          },
        },
        {
          $project: {
            from: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: ['$_id', new Types.ObjectId(tx._id)],
                    },
                    then: {
                      unavailable: { $toDecimal: 0.0 },
                    },
                  },
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
      isValidWalletType: {
        $first: '$isValid.check.walletType',
      },
      from: {
        $first: '$isValid.from',
      },
      sumOfTo: {
        $first: '$isValid.check.sumOfTo',
      },
    },
  },
  {
    $project: {
      isEnoughBalance: {
        $gte: [
          {
            $subtract: [
              { $sum: ['$ads', '$farm', '$personal', '$others'] },
              '$unavailable',
            ],
          },
          '$from',
        ],
      },
      isValidChecksum: {
        $eq: ['$from', '$sumOfTo'],
      },
      isValidWalletType: 1,
    },
  },
];
