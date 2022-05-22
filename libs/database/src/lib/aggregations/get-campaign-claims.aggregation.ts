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

import { FilterQuery, Types } from 'mongoose';
import { Campaign } from '../schemas';
import { GetBalanceResponse } from './get-balance.aggregation';

export type GetCampaignClaimsResponse = Campaign & {
  claims: GetBalanceResponse[];
};

export const pipelineOfGetCampaignClaims = (
  campaignQuery: FilterQuery<Campaign>,
  accountId: string,
) => [
  { $match: campaignQuery },
  {
    $lookup: {
      from: 'transactions',
      let: { campaignId: { $toString: '$_id' } },
      pipeline: [
        { $unwind: '$to' },
        {
          $match: {
            'to.account': Types.ObjectId(accountId),
            'data.campaignId': { $exists: true },
            $expr: { $eq: ['$data.campaignId', '$$campaignId'] },
          },
        },
        { $project: { _id: 0, total: { $toDouble: '$to.value' } } },
      ],
      as: 'claims',
    },
  },
];
