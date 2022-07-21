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

import { CastcleCacheKey } from '@castcle-api/environments';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Meta, PaginationQuery, UserField } from '../dtos';
import { Repository } from '../repositories';
import { Account, Credential, User } from '../schemas';
import { AdsService } from './ads.service';
import { DataService } from './data.service';
import { RankerService } from './ranker.service';
import { UserServiceV2 } from './user.service.v2';

@Injectable()
export class SuggestionServiceV2 {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private rankerService: RankerService,
    private adsService: AdsService,
    private dataService: DataService,
    private userServiceV2: UserServiceV2,
    private repository: Repository,
  ) {}

  async seenV2(account: Account, id: string, credential: Credential) {
    await Promise.all([
      this.repository.seenFeedItem(account, id, credential),
      this.adsService.seenAds(id, credential.id),
    ]);

    const accountId = account.id;
    const cacheSeen: string = await this.cacheManager.get(
      CastcleCacheKey.ofSeen(accountId),
    );

    if (!cacheSeen) {
      this.cacheManager.set(
        CastcleCacheKey.ofSeen(accountId),
        JSON.stringify({
          seenCount: 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    } else {
      const currentSeen: SeenState = JSON.parse(cacheSeen);
      this.cacheManager.set(
        CastcleCacheKey.ofSeen(accountId),
        JSON.stringify({
          ...currentSeen,
          seenCount: currentSeen.seenCount + 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    }

    const cacheSeenAds: string = await this.cacheManager.get(
      CastcleCacheKey.ofSeenAds(accountId),
    );

    if (!cacheSeenAds) {
      this.cacheManager.set(
        CastcleCacheKey.ofSeenAds(accountId),
        JSON.stringify({
          seenCount: 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    } else {
      const currentSeenAds: SeenState = JSON.parse(cacheSeenAds);
      this.cacheManager.set(
        CastcleCacheKey.ofSeenAds(accountId),
        JSON.stringify({
          ...currentSeenAds,
          seenCount: currentSeenAds.seenCount + 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    }
  }

  async seen(account: Account, id: string, credential: Credential) {
    await Promise.all([
      this.rankerService.seenFeedItem(account, id, credential),
      this.adsService.seenAds(id, credential.id),
    ]);

    const accountId = account.id;
    const cacheSeen: string = await this.cacheManager.get(
      CastcleCacheKey.ofSeen(accountId),
    );

    if (!cacheSeen) {
      this.cacheManager.set(
        CastcleCacheKey.ofSeen(accountId),
        JSON.stringify({
          seenCount: 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    } else {
      const currentSeen: SeenState = JSON.parse(cacheSeen);
      this.cacheManager.set(
        CastcleCacheKey.ofSeen(accountId),
        JSON.stringify({
          ...currentSeen,
          seenCount: currentSeen.seenCount + 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    }

    const cacheSeenAds: string = await this.cacheManager.get(
      CastcleCacheKey.ofSeenAds(accountId),
    );

    if (!cacheSeenAds) {
      this.cacheManager.set(
        CastcleCacheKey.ofSeenAds(accountId),
        JSON.stringify({
          seenCount: 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    } else {
      const currentSeenAds: SeenState = JSON.parse(cacheSeenAds);
      this.cacheManager.set(
        CastcleCacheKey.ofSeenAds(accountId),
        JSON.stringify({
          ...currentSeenAds,
          seenCount: currentSeenAds.seenCount + 1,
          lastSeen: new Date(),
        } as SeenState),
      );
    }
  }

  async suggest(user: User, accessKey: string, pageQuery: PaginationQuery) {
    let sliceUsers: User[] = [];
    let users: User[] = await this.querySuggestByCache(accessKey, pageQuery);

    if (users && (pageQuery.sinceId || pageQuery.untilId)) {
      let currentUserIndex = users.findIndex(
        (user) => String(user._id) === pageQuery.sinceId,
      );
      if (pageQuery.untilId) {
        currentUserIndex++;
        sliceUsers = users.slice(
          currentUserIndex,
          currentUserIndex + pageQuery.maxResults,
        );
      } else {
        sliceUsers = users.slice(
          Math.max(currentUserIndex - pageQuery.maxResults, 0),
          pageQuery.maxResults,
        );
      }
    } else {
      users = await this.querySuggestByDataScience(
        user.ownerAccount._id,
        accessKey,
      );
      sliceUsers = users.slice(0, pageQuery.maxResults);
    }

    const { items } = await this.userServiceV2.getPublicUsers(
      user,
      { _id: sliceUsers.map((user) => user._id) },
      {},
      [UserField.Relationships],
    );

    return {
      payload: items,
      meta: Meta.fromDocuments(sliceUsers, users.length),
    };
  }

  private async querySuggestByCache(
    accessKey: string,
    pageQuery: PaginationQuery,
  ) {
    let suggestUsers: { engagements: number; userId: string }[] =
      await this.cacheManager.get(CastcleCacheKey.ofSuggestUser(accessKey));

    if (!suggestUsers) return null;

    let reqUserIndex = suggestUsers?.findIndex(
      (user) =>
        String(user.userId) === String(pageQuery.untilId ?? pageQuery.sinceId),
    );

    if (reqUserIndex === -1) return [];

    if (pageQuery.untilId) {
      reqUserIndex++;
      suggestUsers = suggestUsers.slice(reqUserIndex, suggestUsers.length);
    } else {
      suggestUsers = suggestUsers.slice(0, reqUserIndex);
    }

    return this.findUsersAndFilter(suggestUsers);
  }

  private async querySuggestByDataScience(
    accountId: string,
    accessKey: string,
  ) {
    const suggestUsers = await this.dataService.getFollowingSuggestions(
      accountId,
    );
    const userFiltered = await this.findUsersAndFilter(suggestUsers);
    const newSuggest = userFiltered.map((item) => {
      return suggestUsers.find(
        (suggest) => String(suggest.userId) === String(item._id),
      );
    });

    this.cacheManager.set(CastcleCacheKey.ofSuggestUser(accessKey), newSuggest);

    return userFiltered;
  }

  private async findUsersAndFilter(
    suggestUsers: { engagements: number; userId: string }[],
  ) {
    const userIds = suggestUsers.map((item) => item.userId);
    const users = await this.repository.findUsers({ _id: userIds });
    const sortedUser = suggestUsers.map((item) => {
      return users.find((user) => String(user._id) === String(item.userId));
    });

    return sortedUser.filter(Boolean);
  }
}

type SeenState = {
  seenCount: number;
  lastSeen?: Date;
  lastSuggestion?: Date;
};
