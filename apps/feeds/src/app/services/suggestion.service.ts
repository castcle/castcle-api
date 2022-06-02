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
  Account,
  AdsService,
  Credential,
  DataService,
  FeedItemPayloadItem,
  FeedItemResponse,
  RankerService,
  UserService,
  UserType,
} from '@castcle-api/database';
import { Configs, Environment } from '@castcle-api/environments';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

type SeenState = {
  seenCount: number;
  lastSeen?: Date;
  lastSuggestion?: Date;
};

@Injectable()
export class SuggestionService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataService: DataService,
    private userService: UserService,
    private adsService: AdsService,
    private rankerService: RankerService,
  ) {}

  _seenKey = (accountId: string) => `${accountId}-seen`;
  _seenAdsKey = (accountId: string) => `${accountId}-ads-seen`;

  _resetSeen = (setting: SeenState, seenKey: string) =>
    this.cacheManager.set(
      seenKey,
      JSON.stringify({
        ...setting,
        seenCount: 0,
        lastSeen: new Date(),
        lastSuggestion: new Date(),
      } as SeenState),
    );

  /**
   * Mark Cache that this content have been seen
   * @param accountId
   */
  async seen(account: Account, id: string, credential: Credential) {
    //accountId: string
    await Promise.all([
      this.rankerService.seenFeedItem(account, id, credential),
      this.adsService.seenAds(id, credential.id),
    ]);
    const accountId = account.id;
    const currentSetting: string = await this.cacheManager.get(
      this._seenKey(accountId),
    );
    if (!currentSetting) {
      this.cacheManager.set(
        this._seenKey(accountId),
        JSON.stringify({
          seenCount: 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    } else {
      const setting: SeenState = JSON.parse(currentSetting);
      this.cacheManager.set(
        this._seenKey(accountId),
        JSON.stringify({
          ...setting,
          seenCount: setting.seenCount + 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    }
    const adsSetting: string = await this.cacheManager.get(
      this._seenAdsKey(accountId),
    );
    if (!adsSetting) {
      this.cacheManager.set(
        this._seenAdsKey(accountId),
        JSON.stringify({
          seenCount: 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    } else {
      const setting: SeenState = JSON.parse(adsSetting);
      this.cacheManager.set(
        this._seenAdsKey(accountId),
        JSON.stringify({
          ...setting,
          seenCount: setting.seenCount + 1,
          lastSeen: new Date(),
        } as SeenState),
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
      this._seenKey(accountId),
    );
    const adsSetting: string = await this.cacheManager.get(
      this._seenAdsKey(accountId),
    );
    //no suggest and no ads
    if (!currentSetting && !adsSetting) return feedResponse;
    //has some suggest setting
    if (currentSetting) {
      const setting: SeenState = JSON.parse(currentSetting);
      const diffSuggestionTime =
        new Date().getTime() -
        (setting.lastSuggestion
          ? new Date(setting.lastSuggestion).getTime()
          : 0);
      if (
        setting.seenCount > Configs.Suggestion.MinContent &&
        diffSuggestionTime > Configs.Suggestion.MinDiffTime
      ) {
        console.log('do predict');
        const result = await this.dataService.getFollowingSuggestions(
          accountId,
        );
        const userIds = result.map((item) => item.userId);
        const users = await Promise.all(
          userIds.map((uid) => this.userService.getByIdOrCastcleId(uid)),
        );
        const userResponses = await Promise.all(
          users
            .filter((u) => u && u.type)
            .splice(0, Configs.Suggestion.SuggestAmount)
            .map(async (u) =>
              u.type === UserType.PEOPLE
                ? u.toUserResponse()
                : u.toPageResponse(),
            ),
        );

        if (!userResponses.length) return feedResponse;

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
        const insertIndex =
          Configs.Suggestion.MinContent > feedResponse.payload.length
            ? feedResponse.payload.length - 1
            : Configs.Suggestion.MinContent - 1;
        //in theory should pass by ref
        feedResponse.payload.splice(insertIndex, 0, suggestItem);
        await this._resetSeen(setting, this._seenKey(accountId));
      }
    }
    if (adsSetting) {
      const adsState: SeenState = JSON.parse(adsSetting);
      const diffSuggestionTime =
        new Date().getTime() -
        (adsState.lastSuggestion
          ? new Date(adsState.lastSuggestion).getTime()
          : 0);
      if (
        adsState.seenCount > Environment.ADS_MINIMUM_FEED_VIEW &&
        diffSuggestionTime > Environment.ADS_MINIMUM_FEED_COOL_DOWN
      ) {
        await this._resetSeen(adsState, this._seenAdsKey(accountId));
        return this.adsService.addAdsToFeeds(accountId, feedResponse);
      }
    }
    return feedResponse;
  }
}
