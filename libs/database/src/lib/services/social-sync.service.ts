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
import { CastLogger } from '@castcle-api/logger';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocialProvider } from '../models';
import { SocialSync, User } from '../schemas';
import { SocialSyncDeleteDto, SocialSyncDto } from './../dtos/user.dto';

@Injectable()
export class SocialSyncService {
  private logger = new CastLogger(SocialSyncService.name);

  constructor(
    @InjectModel('SocialSync')
    public socialSyncModel: Model<SocialSync>,
    @InjectModel('User')
    public userModel: Model<User>
  ) {}

  /**
   * get auto-sync accounts by social provider
   * @param {SocialProvider} socialProvider
   * @returns {Promise<SocialSync[]>}
   */
  getAutoSyncAccounts = (
    socialProvider: SocialProvider
  ): Promise<SocialSync[]> => {
    return this.socialSyncModel
      .find({ active: true, autoPost: true, provider: socialProvider })
      .exec();
  };

  /**
   * get auto-sync account by social ID
   * @param {SocialProvider} socialProvider e.g. facebook, google, twitter
   * @param {string} socialId
   * @returns {Promise<SocialSync>}
   */
  getAutoSyncAccountBySocialId = (
    socialProvider: SocialProvider,
    socialId: string
  ): Promise<SocialSync> => {
    return this.socialSyncModel
      .findOne({
        active: true,
        autoPost: true,
        provider: socialProvider,
        socialId,
      })
      .exec();
  };

  /**
   * get all account by social ID
   * @param {SocialProvider} socialProvider e.g. facebook, google, twitter
   * @param {string} socialId
   * @returns {Promise<SocialSync[]>}
   */
  getAllSocialSyncBySocial = (
    socialProvider: SocialProvider,
    socialId: string
  ): Promise<SocialSync[]> => {
    return this.socialSyncModel
      .find({ provider: socialProvider, socialId })
      .exec();
  };

  /**
   * create new language
   * @param {User} user
   * @param {SocialSyncDto} socialSync payload
   * @returns {SocialSync} return new social sync document
   * */
  create = (user: User, socialSync: SocialSyncDto): Promise<SocialSync> => {
    this.logger.log('save social sync.');
    const newSocialSync = new this.socialSyncModel({
      author: { id: user.id },
      provider: socialSync.provider,
      socialId: socialSync.socialId,
      userName: socialSync.userName,
      displayName: socialSync.displayName,
      avatar: socialSync.avatar,
      active: (socialSync.active ??= true),
      autoPost: (socialSync.autoPost ??= true),
      authToken: socialSync.authToken,
    });
    return newSocialSync.save();
  };

  /**
   * get social sync from User Document
   *
   * @param {User} user
   * @returns {SocialSync[]} return all social sync Document
   * */
  getSocialSyncByUser = (user: User): Promise<SocialSync[]> => {
    return this.socialSyncModel.find({ 'author.id': user.id }).exec();
  };

  /**
   * get social sync from User id
   *
   * @param {string} id
   * @returns {SocialSync[]} return all social sync Document
   * */
  getSocialSyncByPageId = (id: string): Promise<SocialSync[]> => {
    return this.socialSyncModel.find({ 'author.id': id as any }).exec();
  };

  /**
   * @param {string} id by Page
   * @returns {SocialSync} page Document
   */
  getPageByPageId = ({ author }: SocialSync): Promise<User> => {
    return this.userModel.findOne({ _id: author.id }).exec();
  };

  /**
   * @param {string} id
   * @param {string} id by User
   * @returns {SocialSync} social sync Document
   */
  getSocialSyncBySocialId = (id: string): Promise<SocialSync> => {
    return this.socialSyncModel.findOne({ _id: id }).exec();
  };

  /**
   * Update the autoPost field of the document with the given socialId
   * @param {string} socialId - The socialId of the socialSync document you want to update.
   * @param {boolean} isAutoPost - boolean
   * @returns Nothing.
   */
  updateAutoPostBySocialId({ id }: SocialSync, isAutoPost: boolean) {
    return this.socialSyncModel
      .updateOne({ _id: id }, { $set: { autoPost: isAutoPost } })
      .exec();
  }

  /**
   * update social sync
   * @param {SocialSyncDto} updateSocialSync payload
   * @param {User} user
   * @returns {SocialSync} return update social sync document
   * */
  update = async (
    updateSocialSync: SocialSyncDto,
    user: User
  ): Promise<SocialSync> => {
    const socialSyncDoc = await this.getSocialSyncByUser(user);
    this.logger.log(`find social sync.`);
    const socialSync = socialSyncDoc.find(
      (x) => x.provider === updateSocialSync.provider
    );
    if (socialSync) {
      this.logger.log('update social sync.');
      if (updateSocialSync.castcleId && user) socialSync.author.id = user.id;
      if (updateSocialSync.provider)
        socialSync.provider = updateSocialSync.provider;
      if (updateSocialSync.socialId)
        socialSync.socialId = updateSocialSync.socialId;
      if (updateSocialSync.userName)
        socialSync.userName = updateSocialSync.userName;
      if (updateSocialSync.displayName)
        socialSync.displayName = updateSocialSync.displayName;
      if (updateSocialSync.avatar) socialSync.avatar = updateSocialSync.avatar;
      socialSync.active = updateSocialSync.active;
      if (updateSocialSync.authToken)
        socialSync.authToken = updateSocialSync.authToken;
      return socialSync.save();
    } else {
      this.logger.warn('Can not found social sync');
      return null;
    }
  };

  /**
   * delete social sync
   * @param {SocialSyncDeleteDto} socialSyncDeleteDto payload
   * @param {User} user
   * @returns {SocialSync} return update social sync document
   * */
  delete = async (
    socialSyncDeleteDto: SocialSyncDeleteDto,
    user: User
  ): Promise<SocialSync> => {
    const socialSyncDoc = await this.getSocialSyncByUser(user);
    this.logger.log(`find social sync.`);
    const deleteSocialSync = socialSyncDoc.find(
      (x) =>
        x.provider === socialSyncDeleteDto.provider &&
        x.socialId === socialSyncDeleteDto.socialId
    );
    if (deleteSocialSync) {
      this.logger.log('delete social sync.');
      deleteSocialSync.active = false;
      return deleteSocialSync.save();
    } else {
      this.logger.warn('Cnn not found social sync');
      return null;
    }
  };
}
