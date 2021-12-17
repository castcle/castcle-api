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
import { ContentDocument } from '../schemas';
import { FeedItemDocument } from '../schemas/feedItem.schema';
import { CastcleFeedQueryOptions, FeedItemMode } from '../dtos/feedItem.dto';
import {
  createCastcleFilter,
  createCastcleMeta,
  createPagination
} from '../utils/common';
import { Account } from '../schemas/account.schema';
import { CastcleIncludes, QueryOption } from '../dtos/common.dto';
import {
  signedContentPayloadItem,
  toUnsignedContentPayloadItem,
  transformContentPayloadToV2
} from '../schemas/content.schema';
import {
  GuestFeedItemPayload,
  GuestFeedItemPayloadItem
} from '../dtos/guestFeedItem.dto';
import { Configs } from '@castcle-api/environments';
import { Image, predictContents } from '@castcle-api/utils/aws';
import { Author } from '../dtos/content.dto';

@Injectable()
export class RankerService {
  constructor(
    @InjectModel('FeedItem')
    public _feedItemModel: Model<FeedItemDocument>,
    @InjectModel('Content')
    public _contentModel: Model<ContentDocument>
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
      .limit(options.limit)
      .sort('-aggregator.createTime')
      .exec();
    const totalFeedItems = await this._feedItemModel.count(filter);
    return {
      total: totalFeedItems,
      items: feedItemResult,
      pagination: createPagination(options, totalFeedItems)
    };
  }

  /**
   * add test feed item that use data from DS
   * @param viewer
   * @param query
   * @returns {GuestFeedItemPayload}
   */
  getTestFeedItemsFromViewer = async (viewer: Account, query: QueryOption) => {
    const startNow = new Date();
    console.debug('start service');
    const filter = await createCastcleFilter(
      { viewer: viewer._id },
      query,
      this._feedItemModel
    );
    const timeAfterFilter = new Date();
    console.debug(
      '- after filter : ',
      timeAfterFilter.getTime() - startNow.getTime()
    );
    console.debug('filter', filter);
    const documents = await this._feedItemModel
      .find(filter)
      .limit(query.maxResults)
      .sort('-aggregator.createTime')
      .exec();
    const timeAfterFind = new Date();
    console.debug(
      '- after find document : ',
      timeAfterFind.getTime() - timeAfterFilter.getTime()
    );
    const contentIds = documents.map((item) => item.content.id);
    const answer = await predictContents(String(viewer._id), contentIds);
    const newAnswer = Object.keys(answer)
      .map((id) => {
        const feedItem = documents.find((k) => k.content.id == id);
        return {
          feedItem,
          score: answer[id] as number
        };
      })
      .sort((a, b) => (a.score > b.score ? -1 : 1))
      .map((t) => t.feedItem);

    return {
      payload: newAnswer.map(
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
              transformContentPayloadToV2(item.content, [])
            ),
            type: 'content'
          } as GuestFeedItemPayloadItem)
      ),
      includes: {
        users: newAnswer
          .map((item) => item.content.author as Author)
          .map((author) => {
            if (author.avatar)
              author.avatar = new Image(author.avatar).toSignUrls();
            else author.avatar = Configs.DefaultAvatarImages;
            return author;
          }),
        casts: newAnswer
          .filter((doc) => doc.content.originalPost)
          .map((c) => c.content.originalPost)
          .map((c) => signedContentPayloadItem(toUnsignedContentPayloadItem(c)))
      },
      meta: createCastcleMeta(newAnswer)
    } as GuestFeedItemPayload;
  };

  getMemberFeedItemsFromViewer = async (
    viewer: Account,
    query: QueryOption
  ) => {
    const filter: any = {
      viewer: viewer._id,
      seen: query.mode === FeedItemMode.Current ? false : true
    };
    if (query.sinceId) {
      const guestFeeditemSince = await this._feedItemModel
        .findById(query.sinceId)
        .exec();
      filter.createdAt = {
        $gt: new Date(guestFeeditemSince.createdAt)
      };
    } else if (query.untilId) {
      const guestFeeditemUntil = await this._feedItemModel
        .findById(query.untilId)
        .exec();
      filter.createdAt = {
        $lt: new Date(guestFeeditemUntil.createdAt)
      };
    }
    const documents = await this._feedItemModel
      .find(filter)
      .limit(query.maxResults)
      .sort('-aggregator.createTime')
      .exec();

    return {
      payload: documents.map(
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
              transformContentPayloadToV2(item.content, [])
            ),
            type: 'content'
          } as GuestFeedItemPayloadItem)
      ),
      includes: new CastcleIncludes({
        users: documents.map((item) => item.content.author),
        casts: documents
          .filter((doc) => doc.content.originalPost)
          .map((c) => c.content.originalPost)
          .map((c) => signedContentPayloadItem(toUnsignedContentPayloadItem(c)))
      }),
      meta: createCastcleMeta(documents)
    } as GuestFeedItemPayload;
  };
}
