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
import { CreateHashtag } from '../dtos/hashtag.dto';
import { HashtagDocument } from '../schemas/hashtag.schema';

@Injectable()
export class HashtagService {
  constructor(
    @InjectModel('Hashtag') public _hashtagModel: Model<HashtagDocument>
  ) {}

  /**
   * get all data from Hashtag Document
   *
   * @returns {HashtagDocument[]} return all Hashtag Document
   */
  async getAll() {
    console.log('get all hashtag');
    return this._hashtagModel.find().exec();
  }

  /**
   * create new hashtag
   * @param {CreateHashtag} hashtag Create Hashtag payload
   * @returns {HashtagDocument} return new hashtag document
   */
  create = async (hashtag: CreateHashtag) => {
    console.log('save hashtag');
    const newHashtag = {
      ...hashtag,
      aggregator: {
        $id: hashtag.aggregator._id
      }
    };

    const createResult = await new this._hashtagModel(newHashtag).save();
    return createResult;
  };
}
