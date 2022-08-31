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

import { Reporting } from '@castcle-api/database';
import { FilterQuery, Types } from 'mongoose';

class GetReportingFilter {
  type?: string[];
  status?: string[];
  sinceId?: string;
  untilId?: string;
  maxResults?: number;
}
const filterReporting = (filter?: GetReportingFilter) => {
  const query: FilterQuery<Reporting> = {};
  if (filter?.type) query.type = { $in: filter.type } as any;
  if (filter?.status) query.status = { $in: filter.status } as any;
  if (filter.sinceId) {
    query._id = {
      $gt: new Types.ObjectId(filter.sinceId),
    };
  }
  if (filter.untilId) {
    query._id = {
      $lt: new Types.ObjectId(filter.untilId),
    };
  }
  return query;
};
export const pipelineOfGetReporting = (filter?: GetReportingFilter) => [
  {
    $sort: { createdAt: -1 },
  },
  {
    $match: filterReporting(filter),
  },
  {
    $facet: {
      reportings: [
        {
          $group: {
            _id: '$payload._id',
            reportingId: { $first: '$_id' },
            reportBy: { $addToSet: '$by' },
            status: { $first: '$status' },
            type: { $first: '$type' },
            user: { $first: '$user' },
            createdAt: { $first: '$createdAt' },
            updatedAt: { $first: '$updatedAt' },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $limit: filter.maxResults,
        },
        {
          $project: {
            _id: '$reportingId',
            payloadId: '$_id',
            reportBy: 1,
            status: 1,
            type: 1,
            user: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ],
      reportedBy: [
        {
          $lookup: {
            from: 'metadatas',
            let: { subject: '$subject', type: 'reporting-subject' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$type', '$$type'] },
                      { $eq: ['$payload.slug', '$$subject'] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  slug: '$payload.slug',
                  name: '$payload.name',
                },
              },
            ],
            as: 'subject',
          },
        },
        {
          $project: {
            id: '$_id',
            message: 1,
            payload: {
              _id: '$payload._id',
              contentId: '$payload._id',
              authorId: '$payload.author.id',
              payload: '$payload.payload',
              type: '$payload.type',
              visibility: '$vpayload.isibility',
              metrics: {
                likeCount: '$payload.engagements.like.count',
                commentCount: '$payload.engagements.comment.count',
                recastCount: '$payload.engagements.recast.count',
                quoteCount: '$payload.engagements.quote.count',
                farmCount: { $ifNull: ['$payload.engagements.farm.count', 0] },
              },
              originalPost: {
                $cond: [
                  {
                    $ne: [{ $ifNull: ['$payload.originalPost', null] }, null],
                  },
                  {
                    _id: '$payload.originalPost._id',
                    contentId: '$payload.originalPost._id',
                    authorId: '$payload.originalPost.author.id',
                    payload: '$payload.originalPost.payload',
                    type: '$payload.originalPost.type',
                    visibility: '$payload.originalPost.visibility',
                    metrics: {
                      likeCount: '$payload.originalPost.engagements.like.count',
                      commentCount:
                        '$payload.originalPost.engagements.comment.count',
                      recastCount:
                        '$payload.originalPost.engagements.recast.count',
                      quoteCount:
                        '$payload.originalPost.engagements.quote.count',
                      farmCount: '$payload.originalPost.engagements.farm.count',
                    },
                    createdAt: '$payload.originalPost.createdAt',
                    updatedAt: '$payload.originalPost.updatedAt',
                  },
                  null,
                ],
              },
              reportedStatus: '$payload.reportedStatus',
              reportedSubject: '$payload.reportedSubject',
              isQuote: '$payload.isQuote',
              isRecast: '$payload.isRecast',
              createdAt: '$payload.createdAt',
              updatedAt: '$payload.updatedAt',
            },
            createdAt: 1,
            updatedAt: 1,
            type: 1,
            user: '$by',
            subject: { $arrayElemAt: ['$subject', 0] },
          },
        },
      ],
    },
  },
];
