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
import { EntityVisibility } from '../dtos';
import { Author } from '../dtos/content.dto';
import { LanguagePayloadDto } from '../dtos/language.dto';
import { UserDocument, UserType } from '../schemas';
import { SocialSyncDocument } from '../schemas/socialSync.schema';

@Injectable()
export class SocialSyncService {
  constructor(
    @InjectModel('SocialSync')
    public _socialSyncModel: Model<SocialSyncDocument>
  ) {}

  /**
   * get social sync from User Document
   *
   * @param {UserDocument} user
   * @returns {SocialSyncDocument[]} return all social sync Document
   */
  async getsocialSyncFromUser(user: UserDocument) {
    const findFilter: {
      'author.id': any;
      visibility: EntityVisibility;
    } = {
      'author.id': user._id,
      visibility: EntityVisibility.Publish
    };
    return this._socialSyncModel.find(findFilter).exec();
  }

  /**
   * transform User => Author object for create a content and use as DTO
   * @private
   * @param {UserDocument} user
   * @returns {Author}
   */
  _getAuthorFromUser = (user: UserDocument) => {
    const author: Author = {
      id: user._id,
      avatar: user.profile?.images?.avatar || null,
      castcleId: user.displayId,
      displayName: user.displayName,
      followed: false,
      type: user.type === UserType.Page ? UserType.Page : UserType.People,
      verified: user.verified
    };
    return author;
  };

  /**
   * create new language
   * @param {LanguagePayloadDto} language language payload
   * @returns {LanguageDocument} return new language document
   */
  async create(user: UserDocument, language: SocialSyncDto) {
    console.log('save language');
    const createResult = await new this._socialSyncModel(language).save();
    return createResult;

    const author = this._getAuthorFromUser(user);
    const contentsToCreate = contentsDtos.map(async ({ payload, type }) => {
      const hashtags =
        this.hashtagService.extractHashtagFromContentPayload(payload);

      await this.hashtagService.createFromTags(hashtags);

      return {
        author,
        payload,
        revisionCount: 0,
        type,
        visibility: EntityVisibility.Publish,
        hashtags: hashtags
      } as Content;
    });

    const contents = await Promise.all(contentsToCreate);

    return this._contentModel.create(contents);
  }
}
