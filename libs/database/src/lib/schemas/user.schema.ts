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
import { Document, Model } from 'mongoose';
import { SearchFollowsResponseDto } from '../dtos';
import { CastcleImage, EntityVisibility } from '../dtos/common.dto';
import { Author } from '../dtos/content.dto';
import { PageResponseDto, UserResponseDto } from '../dtos/user.dto';
import { PageVerified, UserCampaigns, UserVerified } from '../models';
import { Account } from '../schemas/account.schema';
import { CastcleBase } from './base.schema';
import { RelationshipDocument } from './relationship.schema';

export type UserDocument = User & IUser;

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
}

export enum UserType {
  People = 'people',
  Page = 'page',
}

@Schema({ timestamps: true })
export class User extends CastcleBase {
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

  @Prop({ select: false })
  campaigns?: UserCampaigns;
}

export const UserSchema = SchemaFactory.createForClass(User);

export interface IUser extends Document {
  toUserResponse(
    passwordNotSet?: boolean,
    blocked?: boolean,
    blocking?: boolean,
    followed?: boolean
  ): Promise<UserResponseDto>;
  toPageResponse(
    blocked?: boolean,
    blocking?: boolean,
    followed?: boolean
  ): PageResponseDto;
  follow(user: UserDocument): Promise<void>;
  unfollow(user: UserDocument): Promise<void>;
  toSearchTopTrendResponse(): SearchFollowsResponseDto;
  toSearchResponse(): SearchFollowsResponseDto;
  toAuthor(): Author;
}

export interface UserModel extends mongoose.Model<UserDocument> {
  covertToUserResponse(
    user: User | UserDocument,
    followed?: boolean
  ): UserResponseDto;
  toAuthor(user: User | UserDocument): Author;
}

const _covertToUserResponse = (
  self: User | UserDocument,
  followed?: boolean
) => {
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
  self: User | UserDocument,
  followed = false
) => _covertToUserResponse(self, followed);

UserSchema.statics.toAuthor = (self: User | UserDocument) =>
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
  passwordNotSet = false,
  blocked?: boolean,
  blocking?: boolean,
  followed?: boolean
) {
  const self = await (this as UserDocument)
    .populate('ownerAccount')
    .execPopulate();
  const response = _covertToUserResponse(self, followed);
  response.email = self.ownerAccount.email;
  response.blocking = blocking;
  response.blocked = blocked;
  response.passwordNotSet = passwordNotSet;
  return response;
};

UserSchema.methods.toPageResponse = function (
  blocked?: boolean,
  blocking?: boolean,
  followed?: boolean
) {
  return {
    id: (this as UserDocument)._id,
    castcleId: (this as UserDocument).displayId,
    displayName: (this as UserDocument).displayName,
    images: {
      avatar:
        (this as UserDocument).profile &&
        (this as UserDocument).profile.images &&
        (this as UserDocument).profile.images.avatar
          ? new Image((this as UserDocument).profile.images.avatar).toSignUrls()
          : Configs.DefaultAvatarImages,
      cover:
        (this as UserDocument).profile &&
        (this as UserDocument).profile.images &&
        (this as UserDocument).profile.images.cover
          ? new Image((this as UserDocument).profile.images.cover).toSignUrls()
          : Configs.DefaultAvatarCovers,
    },
    followers: {
      count: (this as UserDocument).followerCount,
    },
    following: {
      count: (this as UserDocument).followedCount,
    },
    overview:
      (this as UserDocument).profile && (this as UserDocument).profile.overview
        ? (this as UserDocument).profile.overview
        : null,
    links: {
      facebook:
        (this as UserDocument).profile &&
        (this as UserDocument).profile.socials &&
        (this as UserDocument).profile.socials.facebook
          ? (this as UserDocument).profile.socials.facebook
          : null,
      medium:
        (this as UserDocument).profile &&
        (this as UserDocument).profile.socials &&
        (this as UserDocument).profile.socials.medium
          ? (this as UserDocument).profile.socials.medium
          : null,
      twitter:
        (this as UserDocument).profile &&
        (this as UserDocument).profile.socials &&
        (this as UserDocument).profile.socials.twitter
          ? (this as UserDocument).profile.socials.twitter
          : null,
      youtube:
        (this as UserDocument).profile &&
        (this as UserDocument).profile.socials &&
        (this as UserDocument).profile.socials.youtube
          ? (this as UserDocument).profile.socials.youtube
          : null,
      website:
        (this as UserDocument).profile &&
        (this as UserDocument).profile.websites
          ? (this as UserDocument).profile.websites[0].website
          : null,
    },
    verified: {
      official: (this as UserDocument).verified.official,
    } as PageVerified,
    blocked,
    blocking,
    followed,
    updatedAt: (this as UserDocument).updatedAt.toISOString(),
    createdAt: (this as UserDocument).createdAt.toISOString(),
  } as PageResponseDto;
};

UserSchema.methods.toSearchTopTrendResponse = function () {
  return {
    id: (this as UserDocument)._id,
    castcleId: (this as UserDocument).displayId,
    displayName: (this as UserDocument).displayName,
    overview:
      (this as UserDocument).profile && (this as UserDocument).profile.overview
        ? (this as UserDocument).profile.overview
        : '',
    avatar:
      (this as UserDocument).profile &&
      (this as UserDocument).profile.images &&
      (this as UserDocument).profile.images.avatar
        ? new Image((this as UserDocument).profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
    type: (this as UserDocument).type,
    // TODO !!! need implement aggregator
    aggregator: {
      type: '',
      id: '',
      action: '',
      message: '',
    },
    verified:
      (this as UserDocument).verified &&
      ((this as UserDocument).verified.email ||
        (this as UserDocument).verified.mobile ||
        (this as UserDocument).verified.official),
    count: (this as UserDocument).followerCount,
  } as SearchFollowsResponseDto;
};

UserSchema.methods.toSearchResponse = function () {
  return {
    id: (this as UserDocument)._id,
    castcleId: (this as UserDocument).displayId,
    displayName: (this as UserDocument).displayName,
    overview:
      (this as UserDocument).profile && (this as UserDocument).profile.overview
        ? (this as UserDocument).profile.overview
        : '',
    avatar:
      (this as UserDocument).profile &&
      (this as UserDocument).profile.images &&
      (this as UserDocument).profile.images.avatar
        ? new Image((this as UserDocument).profile.images.avatar).toSignUrls()
        : Configs.DefaultAvatarImages,
    type: (this as UserDocument).type,
    // TODO !!! need implement aggregator
    aggregator: {
      type: '',
      id: '',
      action: '',
      message: '',
      count: 1234,
    },
    verified:
      (this as UserDocument).verified &&
      ((this as UserDocument).verified.email ||
        (this as UserDocument).verified.mobile ||
        (this as UserDocument).verified.official),
    // TODO !!! need implement followed
    followed: true,
  } as SearchFollowsResponseDto;
};

export const UserSchemaFactory = (
  relationshipModel: Model<RelationshipDocument>
  /*contentModel: Model<ContentDocument>,
  feedModel: Model<FeedItemDocument>,
  commentModel: Model<CommentDocument>*/
): mongoose.Schema<any> => {
  /**
   * Make sure all aggregate counter is 0
   */
  UserSchema.pre('save', function (next) {
    if (!(this as UserDocument).visibility)
      (this as UserDocument).visibility = EntityVisibility.Publish;
    if (!(this as UserDocument).followedCount)
      (this as UserDocument).followedCount = 0;
    if (!(this as UserDocument).followerCount)
      (this as UserDocument).followerCount = 0;
    //add activate state
    if (!(this as UserDocument).verified)
      (this as UserDocument).verified = {
        email: false,
        mobile: false,
        official: false,
        social: false,
      } as UserVerified;
    next();
  });

  UserSchema.methods.toAuthor = function () {
    const self = this as UserDocument;
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

  UserSchema.methods.follow = async function (followedUser: UserDocument) {
    const session = await relationshipModel.startSession();
    await session.withTransaction(async () => {
      ///TODO !!! Might have to change if relationship is embed
      const setObject = {
        user: (this as UserDocument)._id,
        followedUser: followedUser._id,
        isFollowPage: false,
        blocking: false,
        visibility: EntityVisibility.Publish,
      };
      if ((followedUser as UserDocument).type === UserType.Page)
        setObject.isFollowPage = true;
      const result = await relationshipModel
        .updateOne(
          {
            user: (this as UserDocument)._id,
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
        (this as UserDocument).followedCount++;
        followedUser.followerCount++;
        await Promise.all([this.save(), followedUser.save()]);
      }
    });
    session.endSession();
  };

  UserSchema.methods.unfollow = async function (followedUser: UserDocument) {
    const session = await relationshipModel.startSession();

    await session.withTransaction(async () => {
      const relationship = await relationshipModel
        .findOne({
          user: (this as UserDocument)._id,
          followedUser: followedUser._id,
          following: true,
        })
        .exec();

      if (!relationship) return;

      (this as UserDocument).followedCount--;
      followedUser.followerCount--;

      const toSaveDocuments: Promise<any>[] = [
        this.save(),
        followedUser.save(),
      ];

      if (relationship.blocking) {
        relationship.following = false;
        toSaveDocuments.push(relationship.save());
      } else {
        toSaveDocuments.push(relationship.delete());
      }

      await Promise.all(toSaveDocuments);
    });

    session.endSession();
  };

  return UserSchema;
};
