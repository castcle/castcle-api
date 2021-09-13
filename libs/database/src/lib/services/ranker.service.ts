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
import {
  CastcleFeedQueryOptions,
  FeedItemDto,
  FeedItemMode
} from '../dtos/feedItem.dto';
import { Content } from '../schemas/content.schema';
import { createPagination } from '../utils/common';
import { Account } from '../schemas/account.schema';
import { ContentAggregator } from '../aggregator/content.aggregator';

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
}
