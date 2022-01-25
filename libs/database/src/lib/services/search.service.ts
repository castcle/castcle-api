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
  TopTrendsQueryOptions,
} from '../dtos/search.dto';
import { CredentialDocument, UserDocument } from '../schemas';
import { HashtagDocument } from '../schemas/hashtag.schema';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel('Hashtag') public _hashtagModel: Model<HashtagDocument>,
    @InjectModel('User') public _userModel: Model<UserDocument>
  ) {}

  private getHashtag(limitFilter, keyword?) {
    let filter;
    if (keyword) {
      filter = {
        $or: [
          { name: { $regex: new RegExp(`^${keyword}`, 'i') } },
          { type: { $regex: new RegExp(`^${keyword}`, 'i') } },
        ],
      };
    }
    return this._hashtagModel
      .find(filter)
      .sort({ score: 'desc' })
      .limit(limitFilter)
      .exec();
  }

  private getFollows(limitFilter, keyword?) {
    let filter;
    if (keyword) {
      const filterFollow: {
        displayId: any;
      } = {
        displayId: { $regex: new RegExp(`^${keyword}`, 'i') },
      };
      filter = filterFollow;
    }

    return this._userModel
      .find(filter)
      .sort({ followerCount: 'desc' })
      .limit(limitFilter)
      .exec();
  }

  private getKeyword(limitFilter, keyword?) {
    let filter;
    if (keyword) {
      const filterKeyword: {
        text: any;
      } = {
        text: { $regex: new RegExp(`^${keyword}`, 'i') },
      };
      filter = filterKeyword;
    }

    // TODO !!! need implement keyword collection
    const mockKeyword = [
      {
        text: 'castcle',
        isTrending: true,
      },
      {
        text: 'coronavirus',
        isTrending: true,
      },
      {
        text: 'election results',
        isTrending: false,
      },
      {
        text: 'kobe bryant',
        isTrending: false,
      },
      {
        text: 'zoom',
        isTrending: true,
      },
      {
        text: 'IPL',
        isTrending: false,
      },
      {
        text: 'India vs New Zealand',
        isTrending: true,
      },
      {
        text: 'Coronavirus update',
        isTrending: true,
      },
      {
        text: 'Joe Biden',
        isTrending: true,
      },
      {
        text: 'Google Classroom',
        isTrending: true,
      },
    ];

    return mockKeyword.filter((x) => x.text.match(filter.text.$regex));
  }

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
      hashtag = await this.getHashtag(options.limit);
    }

    const skipFollows = options.exclude && options.exclude.includes('follows');
    if (!skipFollows) {
      follow = await this.getFollows(options.limit);
    }
    return {
      hashtags: hashtag,
      follows: follow,
      // TODO !!! need implement topics
      topics: [],
    };
  }

  /**
   * get search data from keyword
   *
   * @param {CredentialDocument} credential
   * @param {string} keyword search keyword
   * @param {number} limitFollow limit follows data,
   * @returns {keyword,hashtags,follows} return search data keyword,hashtags,follows Document
   */
  async getSearch(
    credential: CredentialDocument,
    keyword: string,
    limitFollow: number = DEFAULT_TOP_TREND_QUERY_OPTIONS.limit
  ) {
    // TODO !!! need implement search content relate to user
    const limitHashtag = 2;
    const limitKeyword = 3;

    let follow: UserDocument[] = [];
    let hashtag: HashtagDocument[] = [];
    let KeywordResult: { text: string; isTrending: boolean }[] = [];
    if (keyword) {
      const sign = keyword.charAt(0);
      if (sign === '@') {
        follow = await this.getFollows(limitFollow, keyword.slice(1));
      } else if (sign === '#') {
        hashtag = await this.getHashtag(limitHashtag, keyword.slice(1));
      } else {
        hashtag = await this.getHashtag(limitHashtag, keyword);
        follow = await this.getFollows(limitFollow, keyword);
        KeywordResult = await this.getKeyword(limitKeyword, keyword);
      }
    }
    return {
      keywords: KeywordResult,
      hashtags: hashtag,
      follows: follow,
    };
  }
}
