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

import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AccountDocument } from '../schemas/account.schema';
import { CredentialDocument, CredentialModel } from '../schemas';
import { User, UserDocument, UserType } from '../schemas/user.schema';
import { ContentDocument, Content } from '../schemas/content.schema';
import { createPagination } from '../utils/common';
import { PageDto, UpdateUserDto } from '../dtos/user.dto';
import {
  SaveContentDto,
  ContentPayloadDto,
  Author,
  CastcleQueryOptions,
  DEFAULT_QUERY_OPTIONS
} from '../dtos/content.dto';

@Injectable()
export class ContentService {
  constructor(
    @InjectModel('Account') public _accountModel: Model<AccountDocument>,
    @InjectModel('Credential')
    public _credentialModel: CredentialModel,
    @InjectModel('User')
    public _userModel: Model<UserDocument>,
    @InjectModel('Content')
    public _contentModel: Model<ContentDocument>
  ) {}

  /**
   *
   * @param {UserDocument} user the user that create this content if contentDto has no author this will be author by default
   * @param {SaveContentDto} contentDto the content Dto that required for create a conent
   * @returns {ContentDocument} content.save() result
   */
  async createContentFromUser(user: UserDocument, contentDto: SaveContentDto) {
    let author: Author;
    if (!contentDto.author)
      author = {
        id: user._id,
        avatar:
          user.profile && user.profile.images && user.profile.images.avatar
            ? user.profile.images.avatar
            : null,
        castcleId: user.displayId,
        displayName: user.displayName,
        followed: false,
        type: user.type === UserType.Page ? UserType.Page : UserType.People,
        verified: user.verified ? true : false
      };
    else {
      const page = await this._userModel.findById(contentDto.author.id);
      author = {
        id: contentDto.author.id,
        type: UserType.Page,
        avatar:
          page.profile && page.profile.images && page.profile.images.avatar
            ? page.profile.images.avatar
            : null,
        castcleId: page.displayId,
        displayName: page.displayName,
        followed: false,
        verified: page.verified ? true : false
      };
    }
    const newContent = {
      author: author,
      payload: contentDto.payload,
      revisionCount: 0,
      type: contentDto.type
    } as Content;
    const content = new this._contentModel(newContent);
    return content.save();
  }

  /**
   *
   * @param {string} id get content from content's id
   * @returns {ContentDocument}
   */
  getContentFromId = (id: string) => this._contentModel.findById(id).exec();

  /**
   *
   * @param {string} id
   * @param {SaveContentDto} contentDto
   * @returns {ContentDocument}
   */
  updateContentFromId = async (id: string, contentDto: SaveContentDto) => {
    //TODO !!! need to implement with revision
    const content = await this._contentModel.findById(id).exec();
    content.revisionCount++;
    content.payload = contentDto.payload;
    content.type = contentDto.type;
    return content.save();
  };

  /**
   * check content.author.id === user._id
   * @param {UserDocument} user
   * @param {ContentDocument} content
   * @returns {Promise<boolean>}
   */
  checkUserPermissionForEditContent = async (
    user: UserDocument,
    content: ContentDocument
  ) => content.author.id === user._id;

  /**
   *
   * @param {UserDocument} user
   * @param {CastcleQueryOptions} options contain option for sorting page = skip + 1,
   * @returns {Promise<{items:ContentDocument[], total:number, pagination: {Pagination}}>}
   */
  getContentsFromUser = async (
    user: UserDocument,
    options: CastcleQueryOptions = DEFAULT_QUERY_OPTIONS
  ) => {
    const findFilter: { 'author.id': any; type?: string } = {
      'author.id': user._id
    };
    if (options.type) findFilter.type = options.type;
    const query = this._contentModel
      .find(findFilter)
      .skip(options.page - 1)
      .limit(options.limit);
    const totalDocument = await this._contentModel.count(findFilter).exec();
    if (options.sortBy.type === 'desc') {
      return {
        total: totalDocument,
        items: await query.sort(`-${options.sortBy.field}`).exec(),
        pagination: createPagination(options, totalDocument)
      };
    } else
      return {
        total: totalDocument,
        items: await query.sort(`+${options.sortBy.field}`).exec(),
        pagination: createPagination(options, totalDocument)
      };
  };
}
