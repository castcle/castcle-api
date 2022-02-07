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
  DEFAULT_QUERY_OPTIONS,
  NotificationSource,
} from '@castcle-api/database/dtos';
import { Injectable, PipeTransform } from '@nestjs/common';

//TODO !!! need to move this to somewhere else
export const LIMIT_MAX = 1000;

export enum SortByEnum {
  Desc = 'desc',
  Asc = 'asc',
}

/**
 * SortByPipe will transform query params to {field:`sortField`, type:`desc|asc`}
 */
@Injectable()
export class SortByPipe implements PipeTransform {
  /**
   *
   * @param {string} sortByQuery
   * @returns {field:string, type:string}
   */
  transform(sortByQuery?: string): { field: string; type: string } {
    if (sortByQuery && sortByQuery.match(/(desc|asc)\((\w+)\)/)) {
      const sortByResult = sortByQuery.match(/(desc|asc)\((\w+)\)/);
      return {
        type:
          sortByResult[1] === SortByEnum.Desc
            ? SortByEnum.Desc
            : SortByEnum.Asc,
        field: sortByResult[2],
      };
    }
  }
}
/**
 * PagePipe will transform query params to number default would be 0
 */
@Injectable()
export class PagePipe implements PipeTransform {
  /**
   *
   * @param {string} pageQuery
   * @returns {number}
   */
  transform(pageQuery?: string): number {
    if (pageQuery && !isNaN(Number(pageQuery))) return Number(pageQuery);
    return DEFAULT_QUERY_OPTIONS.page;
  }
}

/**
 * LimitPipe will transform query params to number default would be 25
 */
@Injectable()
export class LimitPipe implements PipeTransform {
  /**
   *
   * @param {string} limitQuery
   * @returns {number}
   */
  transform(limitQuery?: string): number {
    if (limitQuery && !isNaN(Number(limitQuery)))
      return Number(limitQuery) <= LIMIT_MAX ? Number(limitQuery) : LIMIT_MAX;
    return DEFAULT_QUERY_OPTIONS.limit;
  }
}

@Injectable()
export class NotificationSourcePipe implements PipeTransform {
  /**
   *
   * @param {string} sourceQuery
   * @returns {string}
   */
  transform(sourceQuery?: string): NotificationSource {
    const source = sourceQuery?.toUpperCase();
    if (
      source &&
      (source === NotificationSource.Profile ||
        source === NotificationSource.Page ||
        source === NotificationSource.System)
    )
      return source;
    return null;
  }
}
