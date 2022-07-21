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
import { SchemaTypes } from 'mongoose';
import {
  Author,
  OwnerResponse,
  PageResponseDto,
  PublicUserResponse,
  SearchFollowsResponseDto,
  UserField,
  UserResponseDto,
} from '../dtos';
import {
  OwnerVerification,
  ReportingStatus,
  UserContact,
  UserProfile,
  UserType,
} from '../models';
import { AccountAuthenId } from './account-authen-id.schema';
import { Account } from './account.schema';
import { CastcleBase } from './base.schema';
import { SocialSync } from './social-sync.schema';

@Schema({ timestamps: true })
class UserDocument extends CastcleBase {
  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'Account',
    index: true,
  })
  ownerAccount: Account;

  /** This is the same as castcleId */
  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true, index: true })
  displayId: string;

  @Prop()
  email?: string;

  @Prop({ type: Object })
  profile?: UserProfile;

  @Prop({ type: String, required: true })
  type: UserType;

  @Prop({ type: Object })
  verified: OwnerVerification;

  @Prop({ default: 0 })
  followerCount: number;

  @Prop({ default: 0 })
  followedCount: number;

  @Prop({ default: 0 })
  casts: number;

  @Prop()
  displayIdUpdatedAt?: Date;

  @Prop({ type: Object })
  contact?: UserContact;

  @Prop({ type: String })
  reportedStatus?: ReportingStatus;

  @Prop({ type: String })
  reportedSubject?: string;
}

export type UserResponseOption = {
  passwordNotSet?: boolean;
  blocked?: boolean;
  blocking?: boolean;
  followed?: boolean;
  balance?: number;
  mobile?: { countryCode: string; number: string };
  linkSocial?: AccountAuthenId[];
  syncSocial?: SocialSync[];
  casts?: number;
};

export class User extends UserDocument {
  canUpdateCastcleId: () => boolean;
  follow: (user: User) => Promise<void>;
  unfollow: (user: User) => Promise<void>;
  toSearchTopTrendResponse: () => SearchFollowsResponseDto;
  toPublicResponse: (dto?: {
    blocked?: boolean;
    blocking?: boolean;
    followed?: boolean;
  }) => PublicUserResponse;
  toOwnerResponse: (dto?: {
    expansionFields?: UserField[];
  }) => Promise<OwnerResponse>;
  /** @deprecated */
  toAuthor: (user?: User | User) => Author;
  /** @deprecated */
  toUserResponse: (option?: UserResponseOption) => Promise<UserResponseDto>;
  /** @deprecated */
  toPageResponse: (
    blocked?: boolean,
    blocking?: boolean,
    followed?: boolean,
    syncSocial?: SocialSync,
    casts?: number,
  ) => PageResponseDto;
}

export const UserSchema = SchemaFactory.createForClass<UserDocument, User>(
  UserDocument,
);
