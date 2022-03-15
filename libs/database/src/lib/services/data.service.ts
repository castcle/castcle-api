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
import { CastLogger } from '@castcle-api/logger';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { lastValueFrom, map } from 'rxjs';

@Injectable()
export class DataService {
  private logger = new CastLogger(DataService.name);

  constructor(private httpService: HttpService) {}

  private async post<T>(url: string, body: any, context: string) {
    const payload = JSON.stringify({ url, body });

    this.logger.log(payload, `${context}:init`);

    try {
      this.logger.time(payload, `${context}:time`);

      const result = await lastValueFrom(
        this.httpService
          .post<{ result: T }>(url, body)
          .pipe(map(({ data }) => data?.result ?? {}))
      );

      this.logger.timeEnd(payload, `${context}:time`);
      this.logger.log(JSON.stringify(result), `${context}:success`);

      return result as T;
    } catch (error: unknown) {
      this.logger.timeEnd(payload, `${context}:time`);
      this.logger.error(error, `${context}:error`);
    }
  }

  async personalizeContents(accountId: string, contentIds: string[]) {
    const url = `${Environment.DS_SERVICE_BASE_URL}/ds_service/personalize_content_predict`;
    const body = { accountId, contents: contentIds };
    const personalizedContents = await this.post<Record<string, number>>(
      url,
      body,
      'personalizeContents'
    );

    return personalizedContents ?? {};
  }

  async getFollowingSuggestions(
    accountId: string
  ): Promise<{ engagements: number; userId: string }[]> {
    const url = `${Environment.DS_SERVICE_BASE_URL}/ds_service/suggest_follow_score`;
    const body = { accountId };
    const followingSuggestions = await this.post<
      { engagements: number; userId: string }[]
    >(url, body, 'getFollowingSuggestions');

    return followingSuggestions ?? [];
  }

  async detectContent(contentId: string) {
    const url = `${Environment.DS_SERVICE_BASE_URL}/ds_service/contentflow`;
    const body = { contentflow: contentId };
    const detection = await this.post<{ illegalClass: boolean }>(
      url,
      body,
      'detectContent'
    );

    return Boolean(detection?.illegalClass);
  }
}
