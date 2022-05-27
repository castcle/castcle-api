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
import { Injectable } from '@nestjs/common';
import {
  ByKeywordResponseDto,
  DEFAULT_TOP_TREND_QUERY_OPTIONS,
  GetByQuery,
  GetKeywordQuery,
  GetTopTrendQuery,
  Meta,
  PayloadHashtagOption,
  ResponseDto,
  TopTrendsResponseDto,
} from '../dtos';
import { User } from '../schemas';
import { UserServiceV2 } from './user.service.v2';
import { Hashtag } from './../schemas/hashtag.schema';
import { ExecuteType } from './../models/feed.enum';
import { Repository } from './../repositories/index';

@Injectable()
export class SearchServiceV2 {
  constructor(
    private repository: Repository,
    private userServiceV2: UserServiceV2,
  ) {}

  private toPayloadHashtags(
    hashtags: Hashtag[],
    options?: PayloadHashtagOption,
  ) {
    return hashtags.map((hashtag, index) => {
      return {
        rank: index + 1,
        id: hashtag._id,
        slug: hashtag.tag,
        name: hashtag.name,
        count: hashtag.score,
        ...options,
      };
    });
  }

  async getTopTrends(
    {
      limit = DEFAULT_TOP_TREND_QUERY_OPTIONS.limit,
      exclude,
    }: GetTopTrendQuery,
    viewer?: User,
  ) {
    let hashtag = [];
    let users = [];

    if (!exclude?.includes(ExecuteType.Hashtags))
      hashtag = await this.repository.findHashtags(
        {},
        { limit: +limit, sort: { score: -1 } },
      );

    if (!exclude?.includes(ExecuteType.Users)) {
      const blocking = await this.userServiceV2.getUserBlock(viewer);
      users = await this.repository.findUsers(
        { execute: blocking },
        { limit: +limit, sort: { followCount: -1 } },
      );
    }

    return {
      hashtags: this.toPayloadHashtags(hashtag),
      users: await this.userServiceV2.convertUsersToUserResponsesV2(
        viewer,
        users,
      ),
    } as TopTrendsResponseDto;
  }

  async getByKeyword(
    { limit = DEFAULT_TOP_TREND_QUERY_OPTIONS.limit, keyword }: GetByQuery,
    viewer: User,
  ) {
    const hashtag = await this.repository.findHashtags(
      {
        keyword: keyword,
      },
      { limit: +limit, sort: { score: -1 } },
    );

    const blocking = await this.userServiceV2.getUserBlock(viewer);

    const users = await this.repository.findUsers(
      {
        execute: blocking,
        keyword: keyword,
      },
      { limit: +limit, sort: { followCount: -1 } },
    );

    return {
      keyword: [
        {
          text: keyword.input,
          isTrending: true,
        },
      ],
      hashtags: this.toPayloadHashtags(hashtag, {
        key: 'hashtag.castcle',
        isTrending: true,
      }),
      users: await this.userServiceV2.convertUsersToUserResponsesV2(
        viewer,
        users,
      ),
    } as ByKeywordResponseDto;
  }

  async getUserMentions(
    { hasRelationshipExpansion, userFields, ...query }: GetKeywordQuery,
    viewer: User,
  ) {
    const blocking = await this.userServiceV2.getUserBlock(viewer);

    const users = await this.repository.findUsers({
      execute: blocking,
      ...query,
    });

    if (!users.length)
      return ResponseDto.ok({
        payload: [],
      });

    return ResponseDto.ok({
      payload: await this.userServiceV2.convertUsersToUserResponsesV2(
        viewer,
        users,
        hasRelationshipExpansion,
        userFields,
      ),
    });
  }

  async getSearchByKeyword(
    { hasRelationshipExpansion, userFields, ...query }: GetKeywordQuery,
    viewer: User,
  ) {
    const blocking = await this.userServiceV2.getUserBlock(viewer);

    const users = await this.repository.findUsers({
      execute: blocking,
      ...query,
    });

    if (!users.length)
      return ResponseDto.ok({
        payload: [],
        meta: { resultCount: 0 },
      });

    const userResponses =
      await this.userServiceV2.convertUsersToUserResponsesV2(
        viewer,
        users,
        hasRelationshipExpansion,
        userFields,
      );

    return ResponseDto.ok({
      payload: userResponses,
      meta: Meta.fromDocuments(userResponses as any),
    });
  }
}