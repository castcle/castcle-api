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
import { ContentDocument, UserDocument } from '../schemas';
import { FeedItemDocument } from '../schemas/feedItem.schema';
import { CastcleFeedQueryOptions, FeedItemMode } from '../dtos/feedItem.dto';
import {
  createCastcleFilter,
  createCastcleMeta,
  createPagination
} from '../utils/common';
import { Account, AccountDocument } from '../schemas/account.schema';
import { CastcleMeta } from '../dtos/common.dto';
import {
  signedContentPayloadItem,
  toSignedContentPayloadItem,
  toUnsignedContentPayloadItem
} from '../schemas/content.schema';
import {
  GuestFeedItemPayload,
  FeedItemPayloadItem
} from '../dtos/guest-feed-item.dto';
import { predictContents } from '@castcle-api/utils/aws';
import { Author, CastcleIncludes } from '../dtos/content.dto';
import { GuestFeedItemDocument } from '../schemas/guestFeedItems.schema';
import { RelationshipDocument } from '../schemas/relationship.schema';
import { PaginationQuery } from '../dtos';
import { UserService } from './user.service';

@Injectable()
export class RankerService {
  constructor(
    @InjectModel('FeedItem')
    public _feedItemModel: Model<FeedItemDocument>,
    @InjectModel('Content')
    public _contentModel: Model<ContentDocument>,
    @InjectModel('GuestFeedItem')
    public _guestFeedItemModel: Model<GuestFeedItemDocument>,
    @InjectModel('Relationship')
    public relationshipModel: Model<RelationshipDocument>,
    @InjectModel('User') public userModel: Model<UserDocument>,
    @InjectModel('Account') public _accountModel: Model<AccountDocument>,
    private userService: UserService
  ) {}

  /**
   *
   * @param viewer
   * @param options
   * @returns
   */
  getFeedItemsFromViewer = (
    viewer: Account,
    options: CastcleFeedQueryOptions
  ) => this.getFeedItemsByFollowedFromViewer(viewer, options);

  async getFeedItemsByFollowedFromViewer(
    viewer: Account,
    options: CastcleFeedQueryOptions
  ) {
    const filter = {
      viewer: viewer._id,
      seen: options.mode === FeedItemMode.Current ? false : true
    };
    const feedItemResult = await this._feedItemModel
      .find(filter)
      .skip(options.page - 1)
      .populate('content')
      .limit(options.limit)
      .sort('-aggregator.createTime')
      .exec();
    const totalFeedItems = await this._feedItemModel.countDocuments(filter);
    return {
      total: totalFeedItems,
      items: feedItemResult,
      pagination: createPagination(options, totalFeedItems)
    };
  }

  /**
   * Get guestFeedItem according to accountCountry code  if have sinceId it will query all feed after sinceId
   * @param {QueryOption} query
   * @param {Account} viewer
   * @returns {GuestFeedItemDocument[]}
   */
  getGuestFeedItems = async (query: PaginationQuery, viewer: Account) => {
    const filter = createCastcleFilter(
      { countryCode: viewer.geolocation?.countryCode?.toLowerCase() ?? 'en' },
      { ...query, sinceId: query.untilId, untilId: query.sinceId }
    );

    const feedItems = await this._guestFeedItemModel
      .find(filter)
      .populate('content')
      .limit(query.maxResults)
      .sort({ score: -1, createdAt: -1 })
      .exec();

    const authors = feedItems.map((feedItem) => feedItem.content.author);
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

    return {
      payload: feedItems.map(
        (item) =>
          ({
            id: item.id,
            feature: {
              slug: 'feed',
              key: 'feature.feed',
              name: 'Feed'
            },
            circle: {
              id: 'for-you',
              key: 'circle.forYou',
              name: 'For You',
              slug: 'forYou'
            },
            payload: toSignedContentPayloadItem(item.content),
            type: 'content'
          } as FeedItemPayloadItem)
      ),
      includes,
      meta: createCastcleMeta(feedItems)
    } as GuestFeedItemPayload;
  };

  /**
   * add member feed item that use data from DS
   * @param viewer
   * @param query
   * @returns {GuestFeedItemPayload}
   */
  getMemberFeedItemsFromViewer = async (
    viewer: Account,
    query: PaginationQuery
  ) => {
    const startNow = new Date();
    console.debug('start service');
    const filter = createCastcleFilter(
      { viewer: viewer._id },
      { ...query, sinceId: query.untilId, untilId: query.sinceId }
    );
    //if have sinceId or untilId but can't find filter.createAt => this is guestFeed
    if (query.sinceId || query.untilId) {
      const refFilter = await this._feedItemModel
        .findById(query.sinceId || query.untilId)
        .exec();
      if (!refFilter) return this.getGuestFeedItems(query, viewer);
      //reset
      viewer.seenContents = [];
    }
    const timeAfterFilter = new Date();
    console.debug(
      '- after filter : ',
      timeAfterFilter.getTime() - startNow.getTime()
    );
    if (viewer.seenContents)
      filter['content.id'] = {
        $nin: viewer.seenContents
      };
    console.debug('filter', filter);
    const documents = await this._feedItemModel
      .find(filter)
      .limit(query.maxResults)
      .populate('content')
      .sort('-aggregator.createTime')
      .exec();
    const timeAfterFind = new Date();
    console.debug(
      '- after find document : ',
      timeAfterFind.getTime() - timeAfterFilter.getTime()
    );
    const contentIds = documents.map((item) => String(item.content.id));
    console.log('contentIds', contentIds);
    const answer = await predictContents(String(viewer._id), contentIds);
    let feedPayload: FeedItemPayloadItem[] = [];
    let newAnswer: any[] = [];
    if (answer) {
      newAnswer = Object.keys(answer)
        .map((id) => {
          const feedItem = documents.find((k) => String(k.content.id) == id);
          return {
            feedItem,
            score: answer[id] as number
          };
        })
        .sort((a, b) => (a.score > b.score ? -1 : 1))
        .map((t) => t.feedItem);
      feedPayload = newAnswer.map(
        (item) =>
          ({
            id: item.id,
            feature: {
              slug: 'feed',
              key: 'feature.feed',
              name: 'Feed'
            },
            circle: {
              id: 'for-you',
              key: 'circle.forYou',
              name: 'For You',
              slug: 'forYou'
            },
            payload: signedContentPayloadItem(
              toUnsignedContentPayloadItem(item.content, [])
            ),
            type: 'content'
          } as FeedItemPayloadItem)
      );
    }

    const includes = {
      users: newAnswer.map((item) => item.content.author),
      casts: newAnswer
        .filter((doc) => doc.content.originalPost)
        .map((c) => c.content.originalPost)
        .map((c) => signedContentPayloadItem(toUnsignedContentPayloadItem(c)))
    };
    let meta: CastcleMeta = createCastcleMeta(newAnswer);
    if (query.maxResults && newAnswer.length < query.maxResults) {
      const guestItemCount = query.maxResults - newAnswer.length;
      const guestFeedPayloads = await this.getGuestFeedItems(
        { ...query, maxResults: guestItemCount },
        viewer
      );
      feedPayload = feedPayload.concat(guestFeedPayloads.payload);
      includes.users = includes.users.concat(guestFeedPayloads.includes.users);
      if (guestFeedPayloads.includes.casts) {
        if (!includes.casts) includes.casts = [];
        includes.casts = includes.casts.concat(
          guestFeedPayloads.includes.casts
        );
      }
      meta = {
        ...guestFeedPayloads.meta,
        resultCount: guestFeedPayloads.meta.resultCount + meta.resultCount
      };
    }

    const authors = includes.users.map((author) => new Author(author));
    includes.users = query.hasRelationshipExpansion
      ? await this.userService.getIncludesUsers(viewer, authors)
      : authors.map((author) => author.toIncludeUser());

    const newSeenContents = viewer.seenContents.concat(
      feedPayload.map((item) => item.payload.id)
    );
    this._accountModel
      .updateOne(
        { _id: viewer._id },
        {
          seenContents: newSeenContents
        }
      )
      .exec();
    return {
      payload: feedPayload,
      includes: new CastcleIncludes(includes),
      meta: meta
    } as GuestFeedItemPayload;
  };

  async sortContentsByScore(accountId: string, contents: ContentDocument[]) {
    const contentIds = contents.map((content) => content.id);
    const score = await predictContents(accountId, contentIds);

    return contents.sort((a, b) => score[a.id] - score[b.id]);
  }
}
