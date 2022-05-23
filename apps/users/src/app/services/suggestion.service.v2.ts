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
  AuthenticationServiceV2,
  DataService,
  UserServiceV2,
} from '@castcle-api/database';
import { Meta, PaginationQuery, UserField } from '@castcle-api/database/dtos';
import { User } from '@castcle-api/database/schemas';
import { Authorizer } from '@castcle-api/utils/decorators';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class SuggestionServiceV2 {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataService: DataService,
    private authenticationServiceV2: AuthenticationServiceV2,
    private userServiceV2: UserServiceV2,
  ) {}

  async suggest(authorizer: Authorizer, pageQuery: PaginationQuery) {
    let sliceUsers: User[] = [];
    let users: User[] = [];

    if (pageQuery.sinceId || pageQuery.untilId) {
      users = await this.querySuggestByCache(authorizer, pageQuery);
      let currentUserIndex = users.findIndex(
        (user) => user._id === pageQuery.sinceId,
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
      users = await this.querySuggestByDataScience(authorizer);
      sliceUsers = users.slice(0, pageQuery.maxResults);
    }

    const usersConvert = await this.userServiceV2.convertUsersToUserResponsesV2(
      authorizer.user,
      sliceUsers,
      pageQuery.userFields?.includes(UserField.Relationships),
    );

    return {
      payload: usersConvert,
      meta: Meta.fromDocuments(sliceUsers),
    };
  }

  private async querySuggestByCache(
    authorizer: Authorizer,
    pageQuery: PaginationQuery,
  ) {
    let suggestUser: { engagements: number; userId: string }[] =
      await this.cacheManager.get(
        this._suggestKey(authorizer.credential.accessToken),
      );
    let reqUserIndex = suggestUser.findIndex(
      (user) => user.userId === (pageQuery.untilId ?? pageQuery.sinceId),
    );

    if (reqUserIndex === -1) return [];

    if (pageQuery.untilId) {
      reqUserIndex++;
      suggestUser = suggestUser.slice(reqUserIndex, suggestUser.length);
    } else {
      suggestUser = suggestUser.slice(0, reqUserIndex);
    }
    const userFiltered = await this.findUsersAndFilter(suggestUser);

    return userFiltered;
  }

  private async querySuggestByDataScience(authorizer: Authorizer) {
    const suggestUser = await this.dataService.getFollowingSuggestions(
      authorizer.account.id,
    );
    const userFiltered = await this.findUsersAndFilter(suggestUser);
    const newSuggest = userFiltered.map((item) => {
      return suggestUser.find((suggest) => suggest.userId === item.id);
    });
    this.cacheManager.set(
      this._suggestKey(authorizer.credential.accessToken),
      newSuggest,
    );

    return userFiltered;
  }

  private async findUsersAndFilter(
    suggestUser: { engagements: number; userId: string }[],
  ) {
    const userIds = suggestUser.map((item) => item.userId);
    const usersList = await Promise.all(
      userIds.map((uid) =>
        this.authenticationServiceV2.getExistedUserFromCastcleId(uid),
      ),
    );

    return usersList.filter(Boolean);
  }

  _suggestKey = (token: string) => `suggest-v2-${token}`;
}
