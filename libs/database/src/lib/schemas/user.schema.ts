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

import { Configs } from '@castcle-api/environments';
import { Image } from '@castcle-api/utils/aws';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { SearchFollowsResponseDto } from '../dtos';
import { CastcleImage, EntityVisibility } from '../dtos/common.dto';
import { Author } from '../dtos/content.dto';
import { PageResponseDto, UserResponseDto } from '../dtos/user.dto';
import { PageVerified, UserVerified } from '../models';
import { Account } from '../schemas';
import { CastcleBase } from './base.schema';
import { Relationship } from './relationship.schema';

type ProfileImage = {
  avatar?: CastcleImage;
  cover?: CastcleImage;
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
  socialSyncs?: boolean;
}

export enum UserType {
  People = 'people',
  Page = 'page',
}

@Schema({ timestamps: true })
class UserDocument extends CastcleBase {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    index: true,
  })
  ownerAccount: Account;

  /**
   * This is the same as castcleId
   * @field this is field displayName
   */
  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true, index: true })
  displayId: string;

  @Prop({ type: Object })
  profile?: UserProfile;

  @Prop({ required: true })
  type: string;

  @Prop({ type: Object })
  verified: UserVerified;

  @Prop()
  followerCount: number;

  @Prop()
  followedCount: number;
}

type UserResponseOption = {
  passwordNotSet?: boolean;
  blocked?: boolean;
  blocking?: boolean;
  followed?: boolean;
  balance?: number;
};

export const UserSchema = SchemaFactory.createForClass(UserDocument);

export class User extends UserDocument {
  covertToUserResponse: (
    user: User | User,
    followed?: boolean
  ) => UserResponseDto;
  follow: (user: User) => Promise<void>;
  unfollow: (user: User) => Promise<void>;
  toSearchTopTrendResponse: () => SearchFollowsResponseDto;
  toSearchResponse: () => SearchFollowsResponseDto;
  toAuthor: (user?: User | User) => Author;
  toUserResponse: (option?: UserResponseOption) => Promise<UserResponseDto>;
  toPageResponse: (
    blocked?: boolean,
    blocking?: boolean,
    followed?: boolean
  ) => PageResponseDto;
}

const _covertToUserResponse = (self: User | User, followed?: boolean) => {
  const selfSocial: any =
    self.profile && self.profile.socials ? { ...self.profile.socials } : {};
  if (self.profile && self.profile.websites && self.profile.websites.length > 0)
    selfSocial.website = self.profile.websites[0].website;
  return {
    id: self._id,
    castcleId: self.displayId,
    displayName: self.displayName,
    dob: self.profile && self.profile.birthdate ? self.profile.birthdate : null,
    followers: {
      count: self.followerCount,
    },
    following: {
      count: self.followedCount,
    },
    images: {
      avatar:
        self.profile && self.profile.images && self.profile.images.avatar
          ? new Image(self.profile.images.avatar).toSignUrls()
          : Configs.DefaultAvatarImages,
      cover:
        self.profile && self.profile.images && self.profile.images.cover
          ? new Image(self.profile.images.cover).toSignUrls()
          : Configs.DefaultAvatarCovers,
    },
    overview:
      self.profile && self.profile.overview ? self.profile.overview : null,
    links: selfSocial,
    verified: self.verified, //self.verified ? true : false,
    followed: followed,
  } as UserResponseDto;
};

UserSchema.statics.covertToUserResponse = (
  self: User | User,
  followed = false
) => _covertToUserResponse(self, followed);

UserSchema.statics.toAuthor = (self: User | User) =>
  ({
    id: self._id,
    avatar:
      self.profile && self.profile.images && self.profile.images.avatar
        ? new Image(self.profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
    castcleId: self.displayId,
    displayName: self.displayName,
    type: self.type,
    verified: self.verified,
  } as Author);

UserSchema.methods.toUserResponse = async function (
  {
    passwordNotSet,
    blocked,
    blocking,
    followed,
    balance,
  } = {} as UserResponseOption
) {
  const self = await (this as User).populate('ownerAccount').execPopulate();
  const response = _covertToUserResponse(self, followed);
  response.email = self.ownerAccount.email;
  response.blocking = blocking;
  response.blocked = blocked;
  response.passwordNotSet = passwordNotSet;
  response.wallet = {
    balance: balance,
  };
  return response;
};

UserSchema.methods.toPageResponse = function (
  blocked?: boolean,
  blocking?: boolean,
  followed?: boolean
) {
  return {
    id: (this as User)._id,
    castcleId: (this as User).displayId,
    displayName: (this as User).displayName,
    images: {
      avatar:
        (this as User).profile &&
        (this as User).profile.images &&
        (this as User).profile.images.avatar
          ? new Image((this as User).profile.images.avatar).toSignUrls()
          : Configs.DefaultAvatarImages,
      cover:
        (this as User).profile &&
        (this as User).profile.images &&
        (this as User).profile.images.cover
          ? new Image((this as User).profile.images.cover).toSignUrls()
          : Configs.DefaultAvatarCovers,
    },
    followers: {
      count: (this as User).followerCount,
    },
    following: {
      count: (this as User).followedCount,
    },
    overview:
      (this as User).profile && (this as User).profile.overview
        ? (this as User).profile.overview
        : null,
    links: {
      facebook:
        (this as User).profile &&
        (this as User).profile.socials &&
        (this as User).profile.socials.facebook
          ? (this as User).profile.socials.facebook
          : null,
      medium:
        (this as User).profile &&
        (this as User).profile.socials &&
        (this as User).profile.socials.medium
          ? (this as User).profile.socials.medium
          : null,
      twitter:
        (this as User).profile &&
        (this as User).profile.socials &&
        (this as User).profile.socials.twitter
          ? (this as User).profile.socials.twitter
          : null,
      youtube:
        (this as User).profile &&
        (this as User).profile.socials &&
        (this as User).profile.socials.youtube
          ? (this as User).profile.socials.youtube
          : null,
      website:
        (this as User).profile && (this as User).profile.websites
          ? (this as User).profile.websites[0].website
          : null,
    },
    verified: {
      official: (this as User).verified.official,
    } as PageVerified,
    blocked,
    blocking,
    followed,
    socialSyncs: (this as User).profile?.socialSyncs ?? null,
    updatedAt: (this as User).updatedAt.toISOString(),
    createdAt: (this as User).createdAt.toISOString(),
  } as PageResponseDto;
};

UserSchema.methods.toSearchTopTrendResponse = function () {
  return {
    id: (this as User)._id,
    castcleId: (this as User).displayId,
    displayName: (this as User).displayName,
    overview:
      (this as User).profile && (this as User).profile.overview
        ? (this as User).profile.overview
        : '',
    avatar:
      (this as User).profile &&
      (this as User).profile.images &&
      (this as User).profile.images.avatar
        ? new Image((this as User).profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
    type: (this as User).type,
    // TODO !!! need implement aggregator
    aggregator: {
      type: '',
      id: '',
      action: '',
      message: '',
    },
    verified:
      (this as User).verified &&
      ((this as User).verified.email ||
        (this as User).verified.mobile ||
        (this as User).verified.official),
    count: (this as User).followerCount,
  } as SearchFollowsResponseDto;
};

UserSchema.methods.toSearchResponse = function () {
  return {
    id: (this as User)._id,
    castcleId: (this as User).displayId,
    displayName: (this as User).displayName,
    overview:
      (this as User).profile && (this as User).profile.overview
        ? (this as User).profile.overview
        : '',
    avatar:
      (this as User).profile &&
      (this as User).profile.images &&
      (this as User).profile.images.avatar
        ? new Image((this as User).profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
    type: (this as User).type,
    // TODO !!! need implement aggregator
    aggregator: {
      type: '',
      id: '',
      action: '',
      message: '',
      count: 1234,
    },
    verified:
      (this as User).verified &&
      ((this as User).verified.email ||
        (this as User).verified.mobile ||
        (this as User).verified.official),
    // TODO !!! need implement followed
    followed: true,
  } as SearchFollowsResponseDto;
};

export const UserSchemaFactory = (
  relationshipModel: Model<Relationship>
  /*contentModel: Model<Content>,
  feedModel: Model<FeedItem>,
  commentModel: Model<Comment>*/
): mongoose.Schema<any> => {
  /**
   * Make sure all aggregate counter is 0
   */
  UserSchema.pre('save', function (next) {
    if (!(this as User).visibility)
      (this as User).visibility = EntityVisibility.Publish;
    if (!(this as User).followedCount) (this as User).followedCount = 0;
    if (!(this as User).followerCount) (this as User).followerCount = 0;
    //add activate state
    if (!(this as User).verified)
      (this as User).verified = {
        email: false,
        mobile: false,
        official: false,
        social: false,
      } as UserVerified;
    next();
  });

  UserSchema.methods.toAuthor = function () {
    const self = this as User;
    return {
      id: self._id,
      avatar:
        self.profile && self.profile.images && self.profile.images.avatar
          ? new Image(self.profile.images.avatar).toSignUrls()
          : Configs.DefaultAvatarImages,
      castcleId: self.displayId,
      displayName: self.displayName,
      type: self.type,
      verified: self.verified,
    } as Author;
  };

  UserSchema.methods.follow = async function (followedUser: User) {
    const session = await relationshipModel.startSession();
    await session.withTransaction(async () => {
      ///TODO !!! Might have to change if relationship is embed
      const setObject = {
        user: (this as User)._id,
        followedUser: followedUser._id,
        isFollowPage: false,
        blocking: false,
        visibility: EntityVisibility.Publish,
      };
      if ((followedUser as User).type === UserType.Page)
        setObject.isFollowPage = true;
      const result = await relationshipModel
        .updateOne(
          {
            user: (this as User)._id,
            followedUser: followedUser._id,
          },
          {
            $setOnInsert: setObject,
            $set: { following: true },
          },
          {
            upsert: true,
          }
        )
        .exec();
      if (result.upserted) {
        (this as User).followedCount++;
        followedUser.followerCount++;
        await Promise.all([this.save(), followedUser.save()]);
      }
    });
    session.endSession();
  };

  UserSchema.methods.unfollow = async function (followedUser: User) {
    const session = await relationshipModel.startSession();

    await session.withTransaction(async () => {
      const relationship = await relationshipModel
        .findOne({
          user: (this as User)._id,
          followedUser: followedUser._id,
          following: true,
        })
        .exec();

      if (!relationship) return;

      (this as User).followedCount--;
      followedUser.followerCount--;

      const toSaves: Promise<any>[] = [this.save(), followedUser.save()];

      if (relationship.blocking) {
        relationship.following = false;
        toSaves.push(relationship.save());
      } else {
        toSaves.push(relationship.delete());
      }

      await Promise.all(toSaves);
    });

    session.endSession();
  };

  return UserSchema;
};
