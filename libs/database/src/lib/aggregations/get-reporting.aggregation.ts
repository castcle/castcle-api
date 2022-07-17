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

class GetReportingFilter {
  type: string[];
  status: string[];
}
export const pipelineOfGetReporting = (filter?: GetReportingFilter) => [
  {
    $sort: { createdAt: -1 },
  },
  {
    $match: filter,
  },
  {
    $facet: {
      reporting: [
        {
          $group: {
            _id: '$payload._id',
            reportBy: { $addToSet: '$by' },
            status: { $last: '$status' },
            type: { $last: '$type' },
            user: { $last: '$user' },
            payload: { $last: '$payload' },
            createdAt: { $last: '$createdAt' },
            updatedAt: { $last: '$updatedAtupdatedAt' },
          },
        },
      ],
      users: [
        { $group: { _id: '$user' } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'users',
          },
        },
        { $replaceWith: { $arrayElemAt: ['$users', 0] } },
      ],
      reportBy: [
        {
          $project: {
            by: 1,
            subject: 1,
            message: 11,
          },
        },
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
                  slug: '$payload.slug',
                  name: '$payload.name',
                },
              },
            ],
            as: 'subject',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'by',
            foreignField: '_id',
            as: 'reportBy',
          },
        },
        {
          $project: {
            _id: 0,
            message: 1,
            user: { $arrayElemAt: ['$reportBy', 0] },
            subject: { $arrayElemAt: ['$subject', 0] },
          },
        },
      ],
    },
  },
];
