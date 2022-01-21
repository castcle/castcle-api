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
import { SocialSyncDocument, UserDocument } from '../schemas';
import { SocialSyncDeleteDto, SocialSyncDto } from './../dtos/user.dto';

@Injectable()
export class SocialSyncService {
  private logger = new CastLogger(SocialSyncService.name);

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
      socialId: socialSync.socialId,
      userName: socialSync.userName,
      displayName: socialSync.displayName,
      avatar: socialSync.avatar,
      active: socialSync.active ? socialSync.active : true,
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

  /**
   * update social sync
   * @param {SocialSyncDto} updateSocialSync payload
   * @param {UserDocument} user
   * @returns {SocialSyncDocument} return update social sync document
   * */
  update = async (
    updateSocialSync: SocialSyncDto,
    user: UserDocument
  ): Promise<SocialSyncDocument> => {
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
      return socialSync.save();
    } else {
      this.logger.warn('Can not found social sync');
      return null;
    }
  };

  /**
   * delete social sync
   * @param {SocialSyncDeleteDto} socialSyncDeleteDto payload
   * @param {UserDocument} user
   * @returns {SocialSyncDocument} return update social sync document
   * */
  delete = async (
    socialSyncDeleteDto: SocialSyncDeleteDto,
    user: UserDocument
  ): Promise<SocialSyncDocument> => {
    const socialSyncDoc = await this.getSocialSyncByUser(user);
    this.logger.log(`find social sync.`);
    const deleteSocialSync = socialSyncDoc.find(
      (x) =>
        x.provider === socialSyncDeleteDto.provider &&
        x.socialId === socialSyncDeleteDto.socialId
    );
    if (deleteSocialSync) {
      this.logger.log('delete social sync.');
      return deleteSocialSync.delete();
    } else {
      this.logger.warn('Cnn not found social sync');
      return null;
    }
  };
}
