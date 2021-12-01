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

import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EntityVisibility, SocialSyncDto } from '../dtos';
import { Author } from '../dtos/content.dto';
import { UserDocument, UserType } from '../schemas';
import { SocialSync } from '../schemas/socialSync.schema';
@Injectable()
export class SocialSyncService {
  private readonly logger = new CastLogger(
    SocialSyncService.name,
    CastLoggerOptions
  );
  constructor(
    @InjectModel('SocialSync')
    private socialSyncModel: Model<SocialSync>
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
    return this.socialSyncModel.find(findFilter).exec();
  }

  /**
   * create new language
   * @param {UserDocument} user
   * @param {SocialSyncDto} socialSync payload
   * @returns {SocialSyncDocument} return new social sync document
   */
  async create(user: UserDocument, socialSync: SocialSyncDto) {
    this.logger.log('save social sync.');
    const author: Author = {
      id: user._id,
      avatar: user.profile?.images?.avatar || null,
      castcleId: user.displayId,
      displayName: user.displayName,
      followed: false,
      type: user.type === UserType.Page ? UserType.Page : UserType.People,
      verified: user.verified
    };

    const newSocialSync = new this.socialSyncModel({
      author: author,
      provider: socialSync.provider,
      socialId: socialSync.uid,
      userName: socialSync.userName,
      displayName: socialSync.displayName,
      avatar: socialSync.avatar,
      active: socialSync.active ? socialSync.active : true
    });
    return newSocialSync.save();
  }
}
