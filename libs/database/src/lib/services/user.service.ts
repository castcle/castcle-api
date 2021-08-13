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
import { UserDocument, UserType } from '../schemas/user.schema';
import { PageDto, UpdateUserDto } from '../dtos/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('Account') public _accountModel: Model<AccountDocument>,
    @InjectModel('Credential')
    public _credentialModel: CredentialModel,
    @InjectModel('User')
    public _userModel: Model<UserDocument>
  ) {}

  getUserFromCredential = (credential: CredentialDocument) =>
    this._userModel
      .findOne({ ownerAccount: credential.account._id, type: UserType.People })
      .exec();

  getUserFromId = (id: string) => this._userModel.findById(id).exec();

  updateUser = (user: UserDocument, updateUserDto: UpdateUserDto) => {
    if (!user.profile) user.profile = {};
    if (updateUserDto.overview) user.profile.overview = updateUserDto.overview;
    if (updateUserDto.dob) user.profile.birthdate = updateUserDto.dob;
    if (updateUserDto.links) {
      if (!user.profile.socials) user.profile.socials = {};
      const socialNetworks = ['facebook', 'medium', 'twitter', 'youtube'];
      socialNetworks.forEach((social) => {
        if (updateUserDto.links[social])
          user.profile.socials[social] = updateUserDto.links[social];
        if (updateUserDto.links.website)
          user.profile.websites = [
            {
              website: updateUserDto.links.website,
              detail: updateUserDto.links.website
            }
          ];
      });
    }
    if (updateUserDto.images) {
      if (!user.profile.images) user.profile.images = {};
      if (updateUserDto.images.avatar)
        user.profile.images.avatar = updateUserDto.images.avatar;
      if (updateUserDto.images.cover)
        user.profile.images.cover = updateUserDto.images.cover;
    }
    return user.save();
  };

  deleteUserFromId = (id: string) =>
    this._userModel.findByIdAndDelete(id).exec();

  createPageFromCredential = async (
    credential: CredentialDocument,
    pageDto: PageDto
  ) => {
    const user = await this.getUserFromCredential(credential);
    return this.createPageFromUser(user, pageDto);
  };

  createPageFromUser = (user: UserDocument, pageDto: PageDto) => {
    const newPage = new this._userModel({
      ownerAccount: user.ownerAccount,
      type: UserType.Page,
      displayId: pageDto.username,
      displayName: pageDto.displayName,
      profile: {
        images: {
          avatar: pageDto.avatar,
          cover: pageDto.cover
        }
      }
    });
    return newPage.save();
  };
}
