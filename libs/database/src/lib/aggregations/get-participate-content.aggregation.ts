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

import { DBRef } from 'mongodb';
import { PipelineStage, Types } from 'mongoose';
import { EntityVisibility } from '../dtos';

export class GetParticipatesFilter {
  targetRef: DBRef | DBRef[];
  userId?: string;
}

export const pipelineOfGetParticipate = ({
  targetRef,
  userId,
}: GetParticipatesFilter): PipelineStage[] => [
  { $sort: { createdAt: -1 } },
  {
    $match: {
      targetRef,
      user: new Types.ObjectId(userId),
      visibility: EntityVisibility.Publish,
    },
  },
  {
    $project: {
      targetRef: '$targetRef',
      type: '$type',
    },
  },
  {
    $facet: {
      liked: [{ $match: { type: 'like' } }, { $limit: 1 }],
      recasted: [{ $match: { type: 'recast' } }, { $limit: 1 }],
      reported: [{ $match: { type: 'report' } }, { $limit: 1 }],
      quoted: [{ $match: { type: 'quote' } }, { $limit: 1 }],
      commented: [{ $match: { type: 'comment' } }, { $limit: 1 }],
      farmed: [{ $match: { type: 'farm' } }, { $limit: 1 }],
    },
  },
  {
    $project: {
      liked: { $cond: [{ $gt: ['$liked', 0] }, true, false] },
      quoted: { $cond: [{ $gt: ['$quoted', 0] }, true, false] },
      recasted: { $cond: [{ $gt: ['$recasted', 0] }, true, false] },
      commented: {
        $cond: [{ $gt: ['$commented', 0] }, true, false],
      },
      reported: { $cond: [{ $gt: ['$reported', 0] }, true, false] },
      farmed: { $cond: [{ $gt: ['$farmed', 0] }, true, false] },
    },
  },
];

export const pipelineOfGetParticipates = ({
  targetRef,
  userId,
}: GetParticipatesFilter): PipelineStage[] => [
  { $sort: { createdAt: -1 } },
  {
    $match: {
      targetRef: {
        $in: targetRef,
      },
      user: new Types.ObjectId(userId),
      visibility: EntityVisibility.Publish,
    },
  },
  {
    $project: {
      targetRef: '$targetRef',
      type: '$type',
    },
  },
  {
    $group: {
      _id: '$targetRef.$id',
      liked: { $sum: { $cond: [{ $eq: ['$type', 'like'] }, 1, 0] } },
      recasted: { $sum: { $cond: [{ $eq: ['$type', 'recast'] }, 1, 0] } },
      reported: { $sum: { $cond: [{ $eq: ['$type', 'report'] }, 1, 0] } },
      quoted: { $sum: { $cond: [{ $eq: ['$type', 'quote'] }, 1, 0] } },
      commented: { $sum: { $cond: [{ $eq: ['$type', 'comment'] }, 1, 0] } },
      farmed: { $sum: { $cond: [{ $eq: ['$type', 'farm'] }, 1, 0] } },
    },
  },
  {
    $project: {
      liked: { $cond: [{ $gt: ['$liked', 0] }, true, false] },
      quoted: { $cond: [{ $gt: ['$quoted', 0] }, true, false] },
      recasted: { $cond: [{ $gt: ['$recasted', 0] }, true, false] },
      commented: {
        $cond: [{ $gt: ['$commented', 0] }, true, false],
      },
      reported: { $cond: [{ $gt: ['$reported', 0] }, true, false] },
      farmed: { $cond: [{ $gt: ['$farmed', 0] }, true, false] },
    },
  },
];
