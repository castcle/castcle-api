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

import { Environment } from '@castcle-api/environments';
import { DBRef } from 'mongodb';
import { PipelineStage, Types } from 'mongoose';
import { EntityVisibility } from '../dtos';
import { AdsAuctionAggregateDto } from '../dtos/ads.dto';
import { AdsBoostStatus, AdsObjective, AdsStatus } from '../models';
import { projectionContent } from './get-contents.aggregation';

export const mockPipe2AdsAuctionAggregate = () => {
  const temp: AdsAuctionAggregateDto = {
    auctionPrice: 0.005,
    campaign: {
      _id: 'testId',
      objective: AdsObjective.Engagement,
      boostStatus: AdsBoostStatus.Running,
      status: AdsStatus.Approved,
      detail: {
        code: 'ADS001',
        dailyBudget: 1,
        duration: 2 * 24 * 60, //2 days = 2 * 24 * 60 minutes
        message: 'Test Please Follow me',
        name: 'Sompop',
      },
      statistics: {
        cpm: 0,
        dailySpent: 0,
        durationSpent: 0,
        engagements: {},
        impressions: 0,
        reaches: 0,
      },
      owner: {
        _id: 'mockAccountId',
      } as any,
      adsRef: {
        $ref: 'users',
        $id: 'testId',
      },
    } as any,
  };
  return temp;
};

export type GetAdsPriceResponse = {
  _id: number;
  total: number;
  price: number;
  ads: any[]; //objectId
  adsRef: DBRef[]; //dbRefs
};

export type GetAdsCampaignQuery = {
  excludeAds?: Types.ObjectId[];
  boostStatus?: AdsBoostStatus;
  status?: AdsStatus;
};

export const pipe2AdsAuctionPrice = () => {
  return [
    {
      $match: {
        boostStatus: 'running',
      },
    },
    {
      $group: {
        _id: 1,
        total: {
          $sum: 1,
        },
        ads: {
          $push: '$_id',
        },
        adsRef: {
          $push: '$adsRef',
        },
      },
    },
    {
      $addFields: {
        price: {
          $multiply: ['$total', Environment.ADS_MINIMUM_CPM],
        },
      },
    },
  ];
};

export const pipe2AvailableAdsCampaign = () => [
  {
    $addFields: {
      budgetLeft: {
        $subtract: ['$detail.dailyBudget', '$statistics.dailySpent'],
      },
    },
  },
  {
    $match: {
      $expr: {
        $gt: ['$budgetLeft', 0],
      },
      boostStatus: 'running',
      'adsRef.$ref': 'content',
    },
  },
];

export const pipe2AdsAuctionAggregate = mockPipe2AdsAuctionAggregate; //will change once proof aggregate

export const pipelineGetAdsCampaigns = ({
  excludeAds,
  ...filters
}: GetAdsCampaignQuery): PipelineStage[] => [
  {
    $addFields: {
      budgetLeft: {
        $subtract: ['$detail.dailyBudget', '$statistics.dailySpent'],
      },
    },
  },
  {
    $match: {
      _id: { $nin: excludeAds },
      $expr: {
        $gt: ['$budgetLeft', 0],
      },
      ...filters,
    },
  },
  {
    $facet: {
      userAd: [
        {
          $sort: {
            createdAt: 1,
          },
        },
        {
          $match: {
            'adsRef.$ref': 'user',
          },
        },
        { $limit: 1 },
        {
          $project: {
            adsRef: '$adsRef',
          },
        },
        {
          $lookup: {
            from: 'users',
            let: {
              userId: '$adsRef.$id',
              visibility: EntityVisibility.Publish,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$userId'] },
                      { $eq: ['$visibility', '$$visibility'] },
                    ],
                  },
                },
              },
            ],
            as: 'payload',
          },
        },
        {
          $unwind: {
            path: '$payload',
          },
        },
      ],
      contentAd: [
        {
          $sort: {
            createdAt: 1,
          },
        },
        {
          $match: {
            'adsRef.$ref': 'content',
          },
        },
        { $limit: 1 },
        {
          $project: {
            adsRef: '$adsRef',
          },
        },
        {
          $lookup: {
            from: 'contents',
            let: {
              contentId: '$adsRef.$id',
              visibility: EntityVisibility.Publish,
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$contentId'] },
                      { $eq: ['$visibility', '$$visibility'] },
                    ],
                  },
                },
              },
              {
                $project: projectionContent(),
              },
            ],
            as: 'payload',
          },
        },
        {
          $unwind: {
            path: '$payload',
          },
        },
      ],
    },
  },
];
