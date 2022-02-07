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

import { UserService } from '@castcle-api/database';
import {
  FeedItemPayloadItem,
  FeedItemResponse,
} from '@castcle-api/database/dtos';
import { UserType } from '@castcle-api/database/schemas';
import { Configs } from '@castcle-api/environments';
import { predictSuggestion } from '@castcle-api/utils/aws';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';

type SeenState = {
  seenCount: number;
  lastSeen?: Date;
  lastSuggestion?: Date;
};

@Injectable()
export class SuggestionService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager,
    private userService: UserService
  ) {}

  _seenKey = (accountId: string) => `${accountId}-seen`;

  /**
   * Mark Cache that this content have been seen
   * @param accountId
   */
  async seen(accountId: string) {
    const currentSetting: string = await this.cacheManager.get(
      this._seenKey(accountId)
    );
    if (!currentSetting) {
      this.cacheManager.set(
        this._seenKey(accountId),
        JSON.stringify({
          seenCount: 1,
          lastSeen: new Date(),
        } as SeenState)
      );
    } else {
      const setting: SeenState = JSON.parse(currentSetting);
      this.cacheManager.set(
        this._seenKey(accountId),
        JSON.stringify({
          ...setting,
          seenCount: setting.seenCount + 1,
          lastSeen: new Date(),
        } as SeenState)
      );
    }
  }

  /**
   * Either return normal feedItemResponse or add Suggest Users in feedItemResponse must be use with seen(accountId)
   * @param accountId
   * @param feedResponse
   * @returns
   */
  async suggest(accountId: string, feedResponse: FeedItemResponse) {
    const currentSetting: string = await this.cacheManager.get(
      this._seenKey(accountId)
    );
    if (!currentSetting) return feedResponse;
    const setting: SeenState = JSON.parse(currentSetting);
    const diffSuggestionTime =
      new Date().getTime() -
      (setting.lastSuggestion ? new Date(setting.lastSuggestion).getTime() : 0);
    if (
      setting.seenCount > Configs.Suggestion.MinContent &&
      diffSuggestionTime > Configs.Suggestion.MinDiffTime
    ) {
      console.log('do predict');
      const result = await predictSuggestion(accountId);
      const userIds = result.result.map((item) => item.userId);
      const users = await Promise.all(
        userIds.map((uid) => this.userService.getByIdOrCastcleId(uid))
      );
      const userResponses = await Promise.all(
        users
          .filter((u) => u && u.type)
          .splice(0, Configs.Suggestion.SuggestAmount)
          .map(async (u) =>
            u.type === UserType.People ? u.toUserResponse() : u.toPageResponse()
          )
      );
      const suggestItem: FeedItemPayloadItem = {
        id: 'for-you',
        feature: {
          slug: 'feed',
          key: 'feature.feed',
          name: 'Feed',
        },
        circle: {
          id: 'for-you',
          key: 'circle.forYou',
          name: 'For You',
          slug: 'forYou',
        },
        type: 'suggestion-follow',
        payload: userResponses,
      };
      console.log('suggestItem', suggestItem);
      const insertIndex =
        Configs.Suggestion.MinContent > feedResponse.payload.length
          ? feedResponse.payload.length - 1
          : Configs.Suggestion.MinContent - 1;

      feedResponse.payload.splice(insertIndex, 0, suggestItem);
      this.cacheManager.set(
        this._seenKey(accountId),
        JSON.stringify({
          ...setting,
          seenCount: 0,
          lastSeen: new Date(),
          lastSuggestion: new Date(),
        } as SeenState)
      );
      return feedResponse;
    } else return feedResponse;
  }
}
