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
} from '../schemas';
import {
  FeedItemResponse,
  FeedItemPayloadItem,
} from '../dtos/guest-feed-item.dto';
import { predictContents } from '@castcle-api/utils/aws';
import { Author, CastcleIncludes } from '../dtos/content.dto';
import { FeedQuery, PaginationQuery } from '../dtos';
import { UserService } from './user.service';

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
    private userService: UserService
  ) {}

  /**
   * Get guestFeedItem according to accountCountry code  if have sinceId it will query all feed after sinceId
   * @param {QueryOption} query
   * @param {Account} viewer
   * @returns {GuestFeedItem[]}
   */
  getGuestFeedItems = async (query: FeedQuery, viewer: Account) => {
    const filter = createCastcleFilter(
      {
        countryCode: viewer.geolocation?.countryCode?.toLowerCase() ?? 'en',
        content: { $nin: viewer.seenContents },
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
    const startNow = new Date();
    console.debug('start service');
    const filter = createCastcleFilter(
      { viewer: viewer._id, seenAt: { $exists: false } },
      { ...query, sinceId: query.untilId, untilId: query.sinceId }
    );
    //if have sinceId or untilId but can't find filter.createAt => this is guestFeed
    if (query.sinceId || query.untilId) {
      const refFilter = await this._feedItemModel
        .findById(query.sinceId || query.untilId)
        .exec();
      if (!refFilter) return this.getGuestFeedItems(query, viewer);
      //reset
      //viewer.seenContents = [];
    }
    const timeAfterFilter = new Date();
    console.debug(
      '- after filter : ',
      timeAfterFilter.getTime() - startNow.getTime()
    );
    /*if (viewer.seenContents)
      filter['content.id'] = {
        $nin: viewer.seenContents,
      };*/
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
    let newAnswer: FeedItem[] = [];
    if (answer) {
      newAnswer = Object.keys(answer)
        .map((id) => {
          const feedItem = documents.find((k) => String(k.content.id) == id);
          return {
            feedItem,
            score: answer[id] as number,
          };
        })
        .sort((a, b) => (a.score > b.score ? -1 : 1))
        .map((t) => t.feedItem);
      feedPayload = this._feedItemsToPayloadItems(newAnswer);
    }

    const includes = {
      users: newAnswer.map((item) => item.content.author),
      casts: newAnswer
        .filter((doc) => doc.content.originalPost)
        .map((c) => c.content.originalPost)
        .map((c) => signedContentPayloadItem(toUnsignedContentPayloadItem(c))),
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
        resultCount: guestFeedPayloads.meta.resultCount + meta.resultCount,
      };
    }
    let authors = includes.users.map((author) => new Author(author));
    authors = authors.concat(
      newAnswer
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
  seenFeedItemForGuest = async (embedAccount: Account, feedItemId: string) => {
    const account = await this._accountModel.findById(embedAccount._id);
    const guestFeed = await this._guestFeedItemModel
      .findById(feedItemId)
      .exec();
    if (!account.seenContents) account.seenContents = [guestFeed.content.id];
    else if (
      account.seenContents.findIndex((cId) => cId === guestFeed.content.id) ===
      -1
    ) {
      account.seenContents.push(guestFeed.content as any as string);
    }
    account.markModified('seenContents');
    return account.save();
  };

  /**
   *
   * @param account
   * @param feedItemId
   * @returns
   */
  seenFeedItem = async (account: Account, feedItemId: string) => {
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
