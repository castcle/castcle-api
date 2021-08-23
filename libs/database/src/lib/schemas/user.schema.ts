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

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model } from 'mongoose';
import { Account, AccountDocument } from '../schemas/account.schema';
import { CastcleBase } from './base.schema';
import {
  PageDto,
  PageResponse,
  PageResponseDto,
  UserResponseDto
} from '../dtos/user.dto';

export type UserDocument = User & IUser;

type ProfileImage = {
  avatar?: string;
  cover?: string;
};

export interface UserProfile {
  birthdate?: string;
  overview?: string;
  works?: string[];
  educations?: string[];
  homeTowns?: string[];
  websites?: {
    website: string;
    detail: string;
  }[];
  socials?: {
    facebook?: string;
    twitter?: string;
    youtube?: string;
    medium?: string;
  };
  details?: string;
  images?: ProfileImage;
}

export enum UserType {
  People = 'people',
  Page = 'page'
}

@Schema({ timestamps: true })
export class User extends CastcleBase {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  })
  ownerAccount: Account;

  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true })
  displayId: string;

  @Prop({ type: Object })
  profile?: UserProfile;

  @Prop({ required: true })
  type: string;

  @Prop()
  verified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

export interface IUser extends Document {
  toUserResponse(): Promise<UserResponseDto>;
  toPageResponse(): PageResponseDto;
}

UserSchema.methods.toUserResponse = async function () {
  const self = await (this as UserDocument)
    .populate('ownerAccount')
    .execPopulate();
  const selfSocial: any =
    self.profile && self.profile.socials ? { ...self.profile.socials } : {};
  if (self.profile && self.profile.websites && self.profile.websites.length > 0)
    selfSocial.website = self.profile.websites[0].website;
  return {
    id: self._id,
    castcleId: self.displayId,
    dob: self.profile && self.profile.birthdate ? self.profile.birthdate : null,
    email: self.ownerAccount.email,
    followers: {
      count: 0
    }, // TODO !!!
    following: {
      count: 0
    }, // TODO !!!
    images: {
      avatar:
        self.profile && self.profile.images && self.profile.images.avatar
          ? self.profile.images.avatar
          : 'http://placehold.it/100x100', // TODO !!! need to check S3 about static url
      cover:
        self.profile && self.profile.images && self.profile.images.cover
          ? self.profile.images.cover
          : 'http://placehold.it/200x200'
    },
    overview:
      self.profile && self.profile.overview ? self.profile.overview : null,
    links: selfSocial,
    verified: self.verified ? true : false
  } as UserResponseDto;
};

UserSchema.methods.toPageResponse = function () {
  return {
    username: (this as UserDocument).displayId,
    displayName: (this as UserDocument).displayName,
    avatar: (this as UserDocument).profile.images.avatar,
    cover: (this as UserDocument).profile.images.cover,
    updated: (this as UserDocument).updatedAt.toISOString(),
    created: (this as UserDocument).createdAt.toISOString()
  } as PageResponseDto;
};
