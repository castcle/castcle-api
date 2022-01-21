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
  CastcleQueryOptions,
  CountryPayloadDto,
  DEFAULT_COUNTRY_QUERY_OPTIONS,
} from '../dtos';
import { CountryDocument } from '../schemas/country.schema';

@Injectable()
export class CountryService {
  constructor(
    @InjectModel('Country') public _countryModel: Model<CountryDocument>
  ) {}

  /**
   * get all data from country Document
   *
   * @returns {CountryDocument[]} return all country Document
   */
  async getAll(options: CastcleQueryOptions = DEFAULT_COUNTRY_QUERY_OPTIONS) {
    console.log(options);
    let query = this._countryModel.find();
    if (options.sortBy.type === 'desc') {
      query = query.sort(`-${options.sortBy.field}`);
    } else {
      query = query.sort(`${options.sortBy.field}`);
    }
    return query.exec();
  }

  /**
   * get country by dialCode
   * @param {string} dialCode country dialCode
   * @returns {CountryDocument} return country document result
   */
  async getByDialCode(dialCode: string) {
    return this._countryModel
      .findOne({
        dialCode: dialCode,
      })
      .exec();
  }

  /**
   * create new country
   * @param {CountryPayloadDto} country country payload
   * @returns {CountryDocument} return new country document
   */
  async create(country: CountryPayloadDto) {
    const createResult = await new this._countryModel(country).save();
    return createResult;
  }
}
