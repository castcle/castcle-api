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

import { CastcleMeta, CastcleQueryOptions } from '../dtos/common.dto';
import { Document } from 'mongoose';
import { Pagination } from '../dtos/common.dto';

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

  pagination.self = queryOptions.page;
  if (queryOptions.page - 1 > 0) {
    pagination.previous = queryOptions.page - 1;
  }
  const totalPages = Math.ceil(totalDocuments / queryOptions.limit);
  if (queryOptions.page < totalPages) pagination.next = queryOptions.page + 1;
  pagination.limit = queryOptions.limit;
  return pagination;
};

export const createCastcleMeta = (documents: Document[]): CastcleMeta => {
  const meta = new CastcleMeta();
  if (documents && documents.length > 0) {
    meta.oldestId = documents[0].id;
    meta.newestId = documents[documents.length - 1].id;
  }
  meta.resultCount = documents.length;
  return meta;
};
