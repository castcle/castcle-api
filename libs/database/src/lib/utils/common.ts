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

import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import {
  CastcleMeta,
  CastcleQueryOptions,
  Pagination,
  QueryOption,
} from '../dtos/common.dto';
import { RelationshipDocument } from '../schemas/relationship.schema';

/**
 *
 * @param {CastcleQueryOptions} queryOptions
 * @param {number} totalDocuments
 * @returns {Pagination} pagination opject of query object
 */
export const createPagination = (
  queryOptions: CastcleQueryOptions,
  totalDocuments: number
): Pagination => {
  const pagination = new Pagination();
  if (!queryOptions) return pagination;

  pagination.self = queryOptions.page;
  if (queryOptions.page - 1 > 0) {
    pagination.previous = queryOptions.page - 1;
  }
  const totalPages = Math.ceil(totalDocuments / queryOptions.limit);
  if (queryOptions.page < totalPages) pagination.next = queryOptions.page + 1;
  pagination.limit = queryOptions.limit;
  return pagination;
};

export const createCastcleMeta = (
  documents: Document[],
  totalCount?: number
): CastcleMeta => {
  const meta = new CastcleMeta();
  if (documents && documents.length > 0) {
    meta.oldestId = documents[documents.length - 1].id;
    meta.newestId = documents[0].id;
  }
  meta.resultCount = documents.length;
  if (totalCount) meta.resultTotal = totalCount;
  return meta;
};

export const createCastcleFilter = (filter: any, queryOption: QueryOption) => {
  if (queryOption.sinceId) {
    filter._id = {
      $gt: mongoose.Types.ObjectId(queryOption.sinceId),
    };
  } else if (queryOption.untilId) {
    filter._id = {
      $lt: mongoose.Types.ObjectId(queryOption.untilId),
    };
  }
  return filter;
};

export const getRelationship = (
  relationships: RelationshipDocument[],
  viewerId: string,
  authorId: string,
  hasRelationshipExpansion: boolean
) => {
  if (!hasRelationshipExpansion) return {};

  const authorRelationship = relationships.find(
    ({ followedUser, user }) =>
      String(user) === String(authorId) &&
      String(followedUser) === String(viewerId)
  );

  const getterRelationship = relationships.find(
    ({ followedUser, user }) =>
      String(followedUser) === String(authorId) &&
      String(user) === String(viewerId)
  );

  return {
    blocked: Boolean(getterRelationship?.blocking),
    blocking: Boolean(authorRelationship?.blocking),
    followed: Boolean(getterRelationship?.following),
  };
};
