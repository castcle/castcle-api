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
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeedItemDto } from '../dtos/feedItem.dto';
import { createCastcleFilter, createCastcleMeta } from '../utils/common';
import { CastcleMeta } from '../dtos/common.dto';
import {
  Content,
  User,
  FeedItem,
  Account,
  signedContentPayloadItem,
  toSignedContentPayloadItem,
  toUnsignedContentPayloadItem,
  GuestFeedItem,
  Relationship,
  UserType,
  DefaultContent,
} from '../schemas';
import {
  FeedItemResponse,
  FeedItemPayloadItem,
} from '../dtos/guest-feed-item.dto';
import { predictContents } from '@castcle-api/utils/aws';
import { Author, CastcleIncludes } from '../dtos/content.dto';
import { FeedQuery, PaginationQuery, UserFeedAggregatorDto } from '../dtos';
import { UserService } from './user.service';
import { ContentAggregator, pipe2ContentFeedAggregator } from '../aggregations';
import { Environment } from '@castcle-api/environments';

@Injectable()
export class RankerService {
  constructor(
    @InjectModel('FeedItem')
    public _feedItemModel: Model<FeedItem>,
    @InjectModel('Content')
    public _contentModel: Model<Content>,
    @InjectModel('GuestFeedItem')
    public _guestFeedItemModel: Model<GuestFeedItem>,
    @InjectModel('Relationship')
    public relationshipModel: Model<Relationship>,
    @InjectModel('User') public userModel: Model<User>,
    @InjectModel('Account') public _accountModel: Model<Account>,
    private userService: UserService,
    @InjectModel('DefaultContent')
    public _defaultContentModel: Model<DefaultContent>
  ) {}

  /**
   * Get guestFeedItem according to accountCountry code  if have sinceId it will query all feed after sinceId
   * @param {QueryOption} query
   * @param {Account} viewer
   * @returns {GuestFeedItem[]}
   */
  getGuestFeedItems = async (
    query: PaginationQuery,
    viewer: Account,
    excludeContents?: any[]
  ) => {
    console.log('exclude', excludeContents);
    let prefix_feeds_payload: FeedItemPayloadItem[] = [];
    let prefix_feeds: DefaultContent[];
    //if no pagination = add default
    if (!(query.untilId || query.sinceId)) {
      prefix_feeds = await this._defaultContentModel
        .find({ index: { $gte: 0 } })
        .populate('content')
        .sort({ index: 1 });
      prefix_feeds_payload = prefix_feeds.map(
        (item) =>
          ({
            id: 'default',
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
            payload: toSignedContentPayloadItem(item.content),
            type: 'content',
          } as FeedItemPayloadItem)
      );
    }
    const filter = createCastcleFilter(
      {
        countryCode: viewer.geolocation?.countryCode?.toLowerCase() ?? 'en',
        content: { $nin: excludeContents },
      },
      { ...query, sinceId: query.untilId, untilId: query.sinceId }
    );
    const feedItems = await this._guestFeedItemModel
      .find(filter)
      .populate('content')
      .limit(query.maxResults)
      .sort({ score: -1, createdAt: -1 })
      .exec();

    let authors = feedItems.map((feedItem) => feedItem.content.author);
    authors = authors.concat(
      feedItems
        .filter((feedItem) => feedItem.content.originalPost)
        .map((feedItem) => feedItem.content.originalPost.author)
    );
    //add authors fro default
    if (prefix_feeds_payload.length > 0) {
      authors = authors.concat(prefix_feeds.map((p) => p.content.author));
      authors = authors.concat(
        prefix_feeds
          .filter((f) => f.content.originalPost)
          .map((f) => f.content.originalPost.author)
      );
    }
    const casts = feedItems
      .map((feedItem) => {
        if (!feedItem.content?.originalPost) return;

        return toSignedContentPayloadItem(feedItem.content.originalPost);
      })
      .filter(Boolean);

    const includes = new CastcleIncludes({ casts, users: authors });

    includes.users = query.hasRelationshipExpansion
      ? await this.userService.getIncludesUsers(viewer, includes.users)
      : includes.users.map((author) => new Author(author).toIncludeUser());
    console.log('PREFIX', prefix_feeds_payload);
    return {
      payload: prefix_feeds_payload.concat(
        feedItems.map(
          (item) =>
            ({
              id: item.id,
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
              payload: toSignedContentPayloadItem(item.content),
              type: 'content',
            } as FeedItemPayloadItem)
        )
      ),
      includes,
      meta: createCastcleMeta(feedItems),
    } as FeedItemResponse;
  };

  _feedItemsToPayloadItems = (feedDocuments: FeedItem[]) =>
    feedDocuments.map(
      (item) =>
        ({
          id: item.id,
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
          payload: signedContentPayloadItem(
            toUnsignedContentPayloadItem(item.content, [])
          ),
          type: 'content',
        } as FeedItemPayloadItem)
    );

  _getCastcleInclude = async (
    feedDocuments: FeedItem[],
    viewer: Account,
    query: PaginationQuery
  ) => {
    const includes = {
      users: feedDocuments.map((item) => item.content.author),
      casts: feedDocuments
        .filter((doc) => doc.content.originalPost)
        .map((c) => c.content.originalPost)
        .map((c) => signedContentPayloadItem(toUnsignedContentPayloadItem(c))),
    };
    const meta: CastcleMeta = createCastcleMeta(feedDocuments);
    let authors = includes.users.map((author) => new Author(author));
    authors = authors.concat(
      feedDocuments
        .filter((feedItem) => feedItem.content.originalPost)
        .map((feedItem) => new Author(feedItem.content.originalPost.author))
    );
    includes.users = query.hasRelationshipExpansion
      ? await this.userService.getIncludesUsers(viewer, authors)
      : authors.map((author) => author.toIncludeUser());
    return { includes, meta };
  };

  _getMemberFeedHistoryItemsFromViewer = async (
    viewer: Account,
    query: FeedQuery
  ) => {
    console.debug('start service');
    const filter = createCastcleFilter(
      { viewer: viewer._id, seenAt: { $exists: true } },
      { ...query, sinceId: query.untilId, untilId: query.sinceId }
    );
    const documents = await this._feedItemModel
      .find(filter)
      .limit(query.maxResults)
      .populate('content')
      .sort('-seenAt')
      .exec();

    const payload = this._feedItemsToPayloadItems(documents);
    const { includes, meta } = await this._getCastcleInclude(
      documents,
      viewer,
      query
    );
    return {
      payload: payload,
      includes: new CastcleIncludes(includes),
      meta: meta,
    } as FeedItemResponse;
  };

  /**
   * add member feed item that use data from DS
   * @param viewer
   * @param query
   * @returns {FeedItemResponse}
   */
  getMemberFeedItemsFromViewer = async (viewer: Account, query: FeedQuery) => {
    if (query.mode && query.mode === 'history')
      return this._getMemberFeedHistoryItemsFromViewer(viewer, query);
    console.log(viewer);
    const user = await this.userModel.findOne({
      ownerAccount: viewer._id,
      type: UserType.People,
    });
    const aggr = pipe2ContentFeedAggregator({
      FollowFeedMax: Environment.FEED_FOLLOW_MAX,
      FollowFeedRatio: Environment.FEED_FOLLOW_RATIO,
      DecayDays: Environment.FEED_DECAY_DAYS,
      MaxResult: query.maxResults,
      userId: user._id,
    });
    console.log(JSON.stringify(aggr));
    const rawResult = await this.userModel.aggregate(aggr);
    const result: UserFeedAggregatorDto = rawResult[0];
    const contentScore = await predictContents(
      String(viewer._id),
      result.contents.map((c) => String(c))
    );
    const sortedContentIds = Object.keys(contentScore).sort((a, b) =>
      contentScore[a] > contentScore[b] ? -1 : 1
    );
    console.log(sortedContentIds);
    let feeds: FeedItem[] = [];
    let feedPayload: FeedItemPayloadItem[] = [];
    if (contentScore) {
      const feedItemDtos = sortedContentIds.map(
        (contentId) =>
          ({
            content: contentId,
            viewer: viewer,
            calledAt: new Date(),
            aggregator: {
              createTime: new Date(),
            } as ContentAggregator,
            __v: 3,
          } as FeedItemDto)
      );
      feeds = await this._feedItemModel.insertMany(feedItemDtos);
      const embedContents = await this._contentModel.find({
        _id: { $in: sortedContentIds },
      });
      for (let i = 0; i < feeds.length; i++)
        feeds[i].content = embedContents.find(
          (c) => String(c._id) === String(feeds[i].content)
        );
      feedPayload = this._feedItemsToPayloadItems(
        feeds.filter((f) => f.content)
      );
    }

    const includes = {
      users: feeds.map((item) => item.content.author),
      casts: feeds
        .filter((doc) => doc.content.originalPost)
        .map((c) => c.content.originalPost)
        .map((c) => signedContentPayloadItem(toUnsignedContentPayloadItem(c))),
    };
    const meta: CastcleMeta = createCastcleMeta(feeds);
    let authors = includes.users.map((author) => new Author(author));
    authors = authors.concat(
      feeds
        .filter((feedItem) => feedItem.content.originalPost)
        .map((feedItem) => new Author(feedItem.content.originalPost.author))
    );
    includes.users = query.hasRelationshipExpansion
      ? await this.userService.getIncludesUsers(viewer, authors)
      : authors.map((author) => author.toIncludeUser());
    return {
      payload: feedPayload,
      includes: new CastcleIncludes(includes),
      meta: meta,
    } as FeedItemResponse;
  };

  async sortContentsByScore(accountId: string, contents: Content[]) {
    const contentIds = contents.map((content) => content.id);
    const score = await predictContents(accountId, contentIds);

    return contents.sort((a, b) => score[a.id] - score[b.id]);
  }
  /**
   *
   * @param account
   * @param feedItemId
   * @returns
   */
  seenFeedItem = async (account: Account, feedItemId: string) => {
    console.log(account, feedItemId);
    this._feedItemModel
      .updateOne(
        {
          viewer: account._id,
          _id: feedItemId,
          seenAt: {
            $exists: false,
          },
        },
        {
          seenAt: new Date(),
        }
      )
      .exec();
  };

  /**
   *
   * @param account
   * @param feedItemId
   * @returns
   */
  offScreenFeedItem = async (account: Account, feedItemId: string) =>
    this._feedItemModel
      .updateOne(
        {
          viewer: account._id,
          _id: feedItemId,
          offScreenAt: {
            $exists: false,
          },
        },
        {
          offScreenAt: new Date(),
        }
      )
      .exec();
}
