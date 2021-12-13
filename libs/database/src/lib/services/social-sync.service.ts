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
import { SocialProvider, SocialSyncDocument, UserDocument } from '../schemas';
import { SocialSyncDto } from './../dtos/user.dto';

@Injectable()
export class SocialSyncService {
  private readonly logger = new CastLogger(
    SocialSyncService.name,
    CastLoggerOptions
  );
  constructor(
    @InjectModel('SocialSync')
    private socialSyncModel: Model<SocialSyncDocument>,
    @InjectModel('User')
    public userModel: Model<UserDocument>
  ) {}

  /**
   * get auto-sync accounts by social provider
   * @param {SocialProvider} socialProvider
   * @returns {Promise<SocialSyncDocument[]>}
   */
  getAutoSyncAccounts = (
    socialProvider: SocialProvider
  ): Promise<SocialSyncDocument[]> => {
    return this.socialSyncModel
      .find({ active: true, provider: socialProvider })
      .exec();
  };

  /**
   * get auto-sync account by social ID
   * @param {SocialProvider} socialProvider e.g. facebook, google, twitter
   * @param {string} socialId
   * @returns {Promise<SocialSyncDocument>}
   */
  getAutoSyncAccountBySocialId = (
    socialProvider: SocialProvider,
    socialId: string
  ): Promise<SocialSyncDocument> => {
    return this.socialSyncModel
      .findOne({ active: true, provider: socialProvider, socialId })
      .exec();
  };

  /**
   * get all account by social ID
   * @param {SocialProvider} socialProvider e.g. facebook, google, twitter
   * @param {string} socialId
   * @returns {Promise<SocialSyncDocument[]>}
   */
  getAllSocialSyncBySocial = (
    socialProvider: SocialProvider,
    socialId: string
  ): Promise<SocialSyncDocument[]> => {
    return this.socialSyncModel
      .find({ provider: socialProvider, socialId })
      .exec();
  };

  /**
   * create new language
   * @param {UserDocument} user
   * @param {SocialSyncDto} socialSync payload
   * @returns {SocialSyncDocument} return new social sync document
   * */
  create = (
    user: UserDocument,
    socialSync: SocialSyncDto
  ): Promise<SocialSyncDocument> => {
    this.logger.log('save social sync.');
    const newSocialSync = new this.socialSyncModel({
      author: { id: user.id },
      provider: socialSync.provider,
      socialId: socialSync.uid,
      userName: socialSync.userName,
      displayName: socialSync.displayName,
      avatar: socialSync.avatar,
      active: socialSync.active ? socialSync.active : true
    });
    return newSocialSync.save();
  };

  /**
   * get social sync from User Document
   *
   * @param {UserDocument} user
   * @returns {SocialSyncDocument[]} return all social sync Document
   * */
  getSocialSyncByUser = (user: UserDocument): Promise<SocialSyncDocument[]> => {
    return this.socialSyncModel.find({ 'author.id': user.id }).exec();
  };
}
