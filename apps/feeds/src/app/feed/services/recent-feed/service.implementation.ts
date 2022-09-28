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

import { CastcleLogger } from '@castcle-api/common';
import {
  CastcleIncludes,
  ContentServiceV2,
  DataService,
  FeedType,
  GetContentPayload,
  Meta,
  RecentFeedPayload,
  Repository,
  ResponseDto,
  User,
  UserField,
} from '@castcle-api/database';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { RecentFeedDto, RecentFeedService } from './service.abstract';

@Injectable()
export class RecentFeedServiceImpl implements RecentFeedService {
  private logger = new CastcleLogger(RecentFeedServiceImpl.name);

  constructor(
    private contentService: ContentServiceV2,
    private dataService: DataService,
    private repository: Repository,
  ) {}

  async execute({ query, account, requestedBy }: RecentFeedDto) {
    this.logger.log('#RecentFeed:start');
    const [
      { payload: suggestContents },
      { payload: suggestUsers },
      defaultContents,
    ] = await Promise.all([
      this.dataService.suggestContents(account.id, query.maxResults as number),
      account.isGuest && !query.nextToken
        ? this.dataService.suggestUsers(account.id, 2)
        : { payload: [] },
      account.isGuest && !query.nextToken
        ? this.repository.aggregationFeedDefault()
        : [],
    ]);

    this.logger.log(`#suggestContents:${suggestContents.length}`);

    this.logger.log('#initData:success');

    const [contents, users, prepareFeeds] = await Promise.all([
      this.repository.aggregationContentsV2({
        _id: suggestContents
          .filter(({ calledAt }) => !calledAt)
          .map(({ content }) => content),
        ...query,
      }),
      this.repository.findUsers({
        _id: suggestUsers
          .splice(0, 2)
          .map(({ user }) => new Types.ObjectId(user)),
      }),
      suggestContents
        .filter(({ author }) => !author.includes('No_author'))
        .map(({ content, author, calledAt }) => {
          return {
            newFeed: {
              viewer: account.isGuest ? account._id : requestedBy._id,
              content: new Types.ObjectId(content),
              author: new Types.ObjectId(author),
              calledAt: new Date(),
            },
            wasNew: !calledAt,
          };
        }),
    ]);

    this.logger.log(`#defaultContents:${defaultContents.length}`);

    const sortContents = suggestContents
      .map(
        ({ content }) =>
          contents.find(
            ({ contentId }) => String(contentId) === String(content),
          ) as GetContentPayload,
      )
      .filter((content) => content);

    this.logger.log(`#sortContents:${sortContents.length}`);

    const sortUsers = suggestUsers
      .splice(0, 2)
      .map(
        ({ user }) =>
          users.find(({ _id }) => String(user) === String(_id)) as User,
      )
      .filter((user) => user);

    this.logger.log(`#sortUsers:${sortUsers.length}`);

    this.logger.log(`#saveFeedItemFromContents:start`);
    const [
      feeds,
      relationships,
      { payloadContents, includeCasts, includeUsers },
    ] = await Promise.all([
      this.repository.saveFeedItemFromContents(prepareFeeds),
      users && requestedBy
        ? await this.repository.findRelationships({
            userId: requestedBy._id,
            followedUser: users.map(({ _id }) => _id),
          })
        : [],
      this.contentService.convertContentToResponses(
        [...defaultContents, ...sortContents],
        requestedBy?._id,
        query.userFields,
      ),
    ]);

    this.logger.log(`#saveFeedItemFromContents#findRelationships`);

    const feedContents = payloadContents.map(
      (content) =>
        new RecentFeedPayload(
          content,
          FeedType.CONTENT,
          feeds.find((feed) => String(feed.content) === String(content.id))?.id,
        ),
    );

    this.logger.log(`#suggestUsers:${sortUsers.length}`);

    let insertIndex = 6;
    sortUsers.forEach((user, index) => {
      const relationship = relationships.find(
        (relationship) => String(relationship.followedUser) === user.id,
      );

      const payloadUser = user?.toPublicResponse(
        query.userFields?.includes(UserField.Relationships) && requestedBy
          ? {
              blocked: relationship?.blocking ?? false,
              followed: relationship?.following ?? false,
            }
          : {},
      );

      feedContents.splice(
        insertIndex > feedContents.length
          ? feedContents.length - 1 + index
          : insertIndex,
        0,
        new RecentFeedPayload(payloadUser, FeedType.FOLLOW_SUGGESTION) as any,
      );
      insertIndex += insertIndex;
    });

    // //!TODO :: ads feedItem;

    return ResponseDto.ok({
      payload: feedContents,
      includes: new CastcleIncludes({
        users: includeUsers,
        casts: includeCasts,
      }),
      meta: <Meta>{ nextToken: Date.now(), resultCount: feedContents.length },
    });
  }
}
