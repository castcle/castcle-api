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
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DocumentDefinition, Model } from 'mongoose';
import {
  GetFeedContentsResponse,
  GetGuestFeedContentsResponse,
  pipelineOfGetFeedContents,
  pipelineOfGetGuestFeedContents,
} from '../aggregations';
import {
  Author,
  CastcleIncludes,
  CastcleMeta,
  CastcleMetric,
  FeedItemPayloadItem,
  FeedItemResponse,
  FeedQuery,
  Meta,
  PaginationQuery,
} from '../dtos';
import { FeedAggregatorName, FeedAnalyticSource, UserType } from '../models';
import {
  Account,
  Content,
  Credential,
  DefaultContent,
  Engagement,
  FeedItem,
  GuestFeedItem,
  Relationship,
  User,
  signedContentPayloadItem,
  toUnsignedContentPayloadItem,
} from '../schemas';
import { createCastcleFilter, createCastcleMeta } from '../utils/common';
import { DataService } from './data.service';
import { UserService } from './user.service';

@Injectable()
export class RankerService {
  private logger = new CastLogger(RankerService.name);

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
    public _defaultContentModel: Model<DefaultContent>,
    @InjectModel('Engagement')
    public _engagementModel: Model<Engagement>,
    private dataService: DataService,
  ) {}

  /**
   *
   * @param contentId
   * @param {string} userId
   * @returns
   */
  getAllEngagement = async (contentIds: any[], viewerAccount: Account) => {
    const viewer = await this.userService.getUserFromAccountId(
      viewerAccount._id,
    );

    return this._engagementModel
      .find({
        targetRef: {
          $in: contentIds.map((id) => ({
            $ref: 'content',
            $id: id,
          })),
        },
        user: viewer.user.id,
      })
      .exec();
  };

  /**
   * Get guestFeedItem according to accountCountry code  if have sinceId it will query all feed after sinceId
   * @param {QueryOption} query
   * @param {Account} viewer
   * @returns {GuestFeedItem[]}
   */
  getGuestFeedItems = async (
    { maxResults, ...query }: PaginationQuery,
    viewer: Account,
    excludeContents = [],
  ) => {
    const filtersDefault = createCastcleFilter({ index: { $gte: 0 } }, {});

    if (query.untilId || query.sinceId) filtersDefault._id = { $exists: false };

    const filtersGuest = createCastcleFilter(
      {
        countryCode: viewer.geolocation?.countryCode?.toLowerCase() ?? 'en',
        content: { $nin: excludeContents },
      },
      { ...query, reversePagination: true },
    );

    console.log(filtersDefault);

    const pipeline = pipelineOfGetGuestFeedContents({
      filtersDefault,
      filtersGuest,
      maxResults,
    });

    this.logger.log(JSON.stringify(pipeline), 'getFeeds:aggregate');

    const [feedResponses] =
      await this._defaultContentModel.aggregate<GetGuestFeedContentsResponse>(
        pipeline,
      );

    if (!feedResponses.defaultFeeds.length && !feedResponses.guestFeeds.length)
      return {
        payload: [],
        includes: { casts: [], users: [] },
        meta: { resultCount: 0 },
      } as FeedItemResponse;

    const mergeFeeds = [
      ...feedResponses.defaultFeeds,
      ...feedResponses.guestFeeds,
    ];

    const payloadFeeds = await this._feedItemsToPayloadItems(
      mergeFeeds,
      undefined,
      feedResponses.engagements,
    );

    const includesUsers = feedResponses.authors.map((author) =>
      new Author(author).toIncludeUser(),
    );

    const payloadCasts = feedResponses.casts.map((cast) =>
      signedContentPayloadItem(toUnsignedContentPayloadItem(cast)),
    );

    return {
      payload: payloadFeeds,
      includes: new CastcleIncludes({
        casts: payloadCasts,
        users: includesUsers,
      }),
      meta: Meta.fromDocuments(mergeFeeds),
    } as FeedItemResponse;
  };

  _feedItemsToPayloadItems = async (
    feedDocuments: FeedItem[],
    viewer?: Account,
    metrics?: CastcleMetric[],
  ) => {
    const contentIds = feedDocuments.map((feed) => feed.content._id);
    const engagements = viewer
      ? await this.getAllEngagement(contentIds, viewer)
      : [];

    return feedDocuments.map((item) => {
      return {
        id: item._id,
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
          toUnsignedContentPayloadItem(
            item.content,
            engagements,
            metrics?.find(
              (metric) => String(metric.id) === String(item.content._id),
            ),
          ),
        ),
        type: 'content',
      } as FeedItemPayloadItem;
    });
  };

  _getCastcleInclude = async (
    feedDocuments: FeedItem[],
    viewer: Account,
    query: PaginationQuery,
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
        .map((feedItem) => new Author(feedItem.content.originalPost.author)),
    );
    includes.users = await this.userService.getIncludesUsers(
      viewer,
      authors,
      query.hasRelationshipExpansion,
    );

    return { includes: new CastcleIncludes(includes), meta };
  };

  _getMemberFeedHistoryItemsFromViewer = async (
    viewer: Account,
    query: FeedQuery,
  ) => {
    console.debug('start service');
    const filter = createCastcleFilter(
      { viewer: viewer._id, seenAt: { $exists: true } },
      { ...query, sinceId: query.untilId, untilId: query.sinceId },
    );
    const documents = await this._feedItemModel
      .find(filter)
      .limit(query.maxResults)
      .populate('content')
      .sort('-seenAt')
      .exec();

    const payload = await this._feedItemsToPayloadItems(documents, viewer);
    const { includes, meta } = await this._getCastcleInclude(
      documents,
      viewer,
      query,
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
   */
  getFeeds = async (viewer: Account, query: FeedQuery) => {
    this.logger.log(
      JSON.stringify({ viewer: viewer.id, query }),
      'getFeeds:init',
    );

    if (query.mode === 'history') {
      return this._getMemberFeedHistoryItemsFromViewer(viewer, query);
    }

    const user = await this.userModel.findOne({
      ownerAccount: viewer._id,
      type: UserType.PEOPLE,
    });

    const pipeline = pipelineOfGetFeedContents({
      followFeedMax: Environment.FEED_FOLLOW_MAX,
      followFeedRatio: Environment.FEED_FOLLOW_RATIO,
      decayDays: Environment.FEED_DECAY_DAYS,
      duplicateContentMax: Environment.FEED_DUPLICATE_MAX,
      geolocation: viewer.geolocation?.countryCode,
      maxResult: Number(query.maxResults),
      userId: user._id,
      preferLanguages: viewer.preferences.languages,
      calledAtDelay: Environment.FEED_CALLED_AT_DELAY,
    });

    this.logger.log(JSON.stringify(pipeline), 'getFeeds:aggregate');

    const [userFeed] = await this.userModel.aggregate<GetFeedContentsResponse>(
      pipeline,
    );
    this.logger.log('DONE AGGREGATE');

    const followingContentIds = userFeed?.followingContents.map(String) ?? [];
    const globalContentIds = userFeed?.globalContents.map(String) ?? [];
    const feedsContentIds = [...followingContentIds, ...globalContentIds];
    const contentScore = await this.dataService.personalizeContents(
      String(viewer._id),
      feedsContentIds,
    );

    const sortedContentIds = Object.keys(contentScore).sort((a, b) =>
      contentScore[a] > contentScore[b] ? -1 : 1,
    );

    const contents = await this._contentModel.find({
      _id: { $in: sortedContentIds },
    });

    if (!sortedContentIds.length) {
      return {
        payload: [],
        includes: { casts: [], users: [] },
        meta: { resultCount: 0 },
      } as FeedItemResponse;
    }

    const feedDtos = contents.map<DocumentDefinition<FeedItem>>((content) => ({
      author: content.author.id,
      content: content._id,
      viewer,
      calledAt: new Date(),
      aggregator: {
        name: FeedAggregatorName.DEFAULT,
        createTime: new Date(),
      },
      analytics: {
        score: contentScore[content.id] ?? 0,
        source: followingContentIds.includes(content.id)
          ? FeedAnalyticSource.PERSONAL
          : FeedAnalyticSource.GLOBAL,
      },
      __v: 3,
    }));

    const feeds = await this._feedItemModel.insertMany(feedDtos);

    feeds.forEach((feed) => {
      feed.content = contents.find(
        (content) => String(content._id) === String(feed.content),
      );
    });

    const feedPayload = await this._feedItemsToPayloadItems(
      feeds.filter((f) => f.content),
      viewer,
    );

    const casts = feeds
      .filter((feed) => feed.content.originalPost)
      .map((feed) => feed.content.originalPost);

    const castIds = casts.map((cast) => cast._id);
    const castEngagements = castIds.length
      ? await this.getAllEngagement(castIds, viewer)
      : [];

    const authors = [
      ...casts.map((cast) => new Author(cast.author)),
      ...feeds.map((feed) => new Author(feed.content.author)),
    ];

    const includesUsers = await this.userService.getIncludesUsers(
      viewer,
      authors,
      query.hasRelationshipExpansion,
    );

    const castPayload = casts.map((cast) =>
      signedContentPayloadItem(
        toUnsignedContentPayloadItem(cast, castEngagements),
      ),
    );

    return {
      payload: feedPayload,
      includes: new CastcleIncludes({
        casts: castPayload,
        users: includesUsers,
      }),
      meta: Meta.fromDocuments(feeds),
    } as FeedItemResponse;
  };

  async sortContentsByScore(accountId: string, contents: Content[]) {
    const contentIds = contents.map((content) => content.id);
    const score = await this.dataService.personalizeContents(
      accountId,
      contentIds,
    );

    return contents.sort((a, b) => score[a.id] - score[b.id]);
  }

  /**
   *
   * @param account
   * @param feedItemId
   * @returns
   */
  seenFeedItem = async (
    account: Account,
    feedItemId: string,
    credential: Credential,
  ) => {
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
          seenCredential: credential._id,
        },
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
        },
      )
      .exec();

  getFeedItem = async (account: Account, contentId: Content) => {
    return this._feedItemModel
      .findOne({
        viewer: account._id,
        content: contentId,
        seenAt: {
          $exists: false,
        },
      })
      .exec();
  };
}
