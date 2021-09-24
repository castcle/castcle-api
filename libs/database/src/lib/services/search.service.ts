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
import {
  DEFAULT_TOP_TREND_QUERY_OPTIONS,
  TopTrendsQueryOptions
} from '../dtos/search.dto';
import { UserDocument } from '../schemas';
import { HashtagDocument } from '../schemas/hashtag.schema';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel('Hashtag') public _hashtagModel: Model<HashtagDocument>,
    @InjectModel('User') public _userModel: Model<UserDocument>
  ) {}

  /**
   * get Top Trend Hashtags, Follows, Topics
   *
   * @param {TopTrendsQueryOptions} options contain option for filter data,
   * @returns {hashtags,follows,topics} return top trends hashtags,follows,topics Document
   */
  async getTopTrends(
    options: TopTrendsQueryOptions = DEFAULT_TOP_TREND_QUERY_OPTIONS
  ) {
    let hashtag: HashtagDocument[] = [];
    let follow: UserDocument[] = [];
    const skipHashtag = options.exclude && options.exclude.includes('hashtags');
    if (!skipHashtag) {
      hashtag = await this._hashtagModel
        .find()
        .sort({ score: 'desc' })
        .limit(options.limit)
        .exec();
    }

    const skipFollows = options.exclude && options.exclude.includes('follows');
    if (!skipFollows) {
      follow = await this._userModel
        .find()
        .sort({ followerCount: 'desc' })
        .limit(options.limit)
        .exec();
    }
    return {
      hashtags: hashtag,
      follows: follow,
      topics: []
    };
  }
}
