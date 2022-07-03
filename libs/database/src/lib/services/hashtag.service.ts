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
import { CastcleName } from '@castcle-api/utils/commons';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlogPayload, CastcleQueryOptions, SortDirection } from '../dtos';
import { CommentDto } from '../dtos/comment.dto';
import { ImagePayload, ShortPayload } from '../dtos/content.dto';
import { CreateHashtag } from '../dtos/hashtag.dto';
import { Hashtag } from '../schemas';

@Injectable()
export class HashtagService {
  constructor(@InjectModel('Hashtag') public _hashtagModel: Model<Hashtag>) {}

  /**
   * get all data from Hashtag Document
   *
   * @returns {Hashtag[]} return all Hashtag Document
   */
  async getAll() {
    console.log('get all hashtag');
    return this._hashtagModel.find().exec();
  }

  /**
   * create new hashtag
   * @param {CreateHashtag} hashtag Create Hashtag payload
   * @returns {Hashtag} return new hashtag document
   */
  create = async (hashtag: CreateHashtag) => {
    const newHashtag = {
      ...hashtag,
      aggregator: {
        $id: hashtag.aggregator._id,
      },
    };

    const createResult = await new this._hashtagModel(newHashtag).save();
    return createResult;
  };

  /**
   * Create a tag or increase the score of the tags
   * @param {string} tag
   * @returns
   */
  createFromTag = async (tag: string) => {
    return this._hashtagModel
      .updateOne(
        {
          tag: CastcleName.fromTagToSlug(tag),
        },
        {
          $setOnInsert: {
            tag: CastcleName.fromTagToSlug(tag),
            name: tag,
            aggregator: {
              name: 'default',
            },
          },
          $inc: {
            score: 1,
          },
        },
        {
          upsert: true,
        },
      )
      .exec();
  };

  /**
   * Remove score from tag
   * @param {string} tag
   * @returns
   */
  removeFromTag = async (tag: string) => {
    return this._hashtagModel
      .updateOne(
        {
          tag: CastcleName.fromTagToSlug(tag),
          score: {
            $gt: 0,
          },
        },
        {
          $inc: {
            score: -1,
          },
        },
      )
      .exec();
  };

  /**
   * Remove multiple tags
   * @param {string[]} tags
   * @returns
   */
  removeFromTags = async (tags: string[]) =>
    Promise.all(tags.map((tag) => this.removeFromTag(tag)));

  /**
   * Create tags
   * @param {string[]} tags
   * @returns
   */
  createFromTags = (tags: string[]) =>
    Promise.all(tags.map((tag) => this.createFromTag(tag)));

  /**
   * Update only essential tags
   * @param {string[]} newTags
   * @param {string[]} oldTags
   * @returns
   */
  updateFromTags = async (newTags: string[], oldTags?: string[]) => {
    if (oldTags) {
      //find conflict tag
      const removeTags = oldTags.filter(
        (oldTag) => newTags.findIndex((nT) => nT === oldTag) < 0,
      );
      await Promise.all(removeTags.map((t) => this.removeFromTag(t)));
      newTags = newTags.filter(
        (nT) => oldTags.findIndex((oldTag) => nT === oldTag) < 0,
      );
    }
    return Promise.all(newTags.map((tag) => this.createFromTag(tag)));
  };

  /**
   * Return array of hashtag that could create from string
   * @param {string} text
   * @returns {string[]}
   */
  extractHashtagFromText = (text: string) => {
    text = text.replace(/\n/g, ' ');
    return text.match(/\s\#([a-z\dA-Z]+\b)(?!;)/g)
      ? text
          .match(/\s\#([a-z\dA-Z]+\b)(?!;)/g)
          .map((item) => item.split(' #')[1])
          .filter((t) => t)
      : [];
  };

  /**
   * return array of hashtag from ContentPayload
   * @param payload
   * @returns
   */
  extractHashtagFromContentPayload = (
    payload: ShortPayload | BlogPayload | ImagePayload,
  ) => {
    if ((payload as ShortPayload).message) {
      return this.extractHashtagFromText((payload as ShortPayload).message);
    }
    return [];
  };

  /**
   *
   * @param commentDto
   * @returns
   */
  extractHashtagFromCommentDto = (commentDto: CommentDto) => {
    if (commentDto.message) {
      return this.extractHashtagFromText(commentDto.message);
    }
    return [];
  };

  /**
   * Get all hashtag that could get from the system sort by score
   * @param {string} keyword
   * @param {CastcleQueryOptions} queryOption
   * @returns {Hashtag[]}
   */
  searchHashtag = async (
    keyword: string,
    queryOptions: CastcleQueryOptions,
  ) => {
    const query = {
      tag: { $regex: new RegExp('^' + keyword.toLowerCase(), 'i') },
    };

    queryOptions.sortBy = {
      field: 'score',
      type: SortDirection.DESC,
    };

    let hashtagQuery = this._hashtagModel.find(query);

    if (queryOptions?.limit)
      hashtagQuery = hashtagQuery.limit(queryOptions.limit);
    if (queryOptions?.page)
      hashtagQuery = hashtagQuery.skip(queryOptions.page - 1);
    if (queryOptions?.sortBy) {
      const sortDirection = queryOptions.sortBy.type === 'desc' ? '-' : '';
      const sortOrder = `${sortDirection}${queryOptions.sortBy.field}`;

      hashtagQuery = hashtagQuery.sort(sortOrder);
    }
    return hashtagQuery.exec();
  };
}
