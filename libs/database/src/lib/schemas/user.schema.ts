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
import { Model, Schema as MongooseSchema, SchemaTypes } from 'mongoose';
import {
  Author,
  EntityVisibility,
  OwnerResponse,
  PublicUserResponse,
  SearchFollowsResponseDto,
  UserField,
} from '../dtos';
import {
  OwnerVerification,
  ReportingStatus,
  UserContact,
  UserProfile,
  UserType,
} from '../models';
import { Account } from './account.schema';
import { BaseSchema } from './base.schema';

@Schema({ timestamps: true })
export class UserDocument extends BaseSchema {
  @Prop({ type: String, default: EntityVisibility.Publish })
  visibility: EntityVisibility;

  @Prop({ required: true, type: SchemaTypes.ObjectId, ref: 'Account' })
  ownerAccount: Account;

  /** This is the same as castcleId */
  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true })
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

export interface UserMethods {
  canUpdateCastcleId(): boolean;
  follow(user: User): Promise<void>;
  unfollow(user: User): Promise<void>;
  toSearchTopTrendResponse(): SearchFollowsResponseDto;
  toPublicResponse(dto?: {
    blocked?: boolean;
    followed?: boolean;
  }): PublicUserResponse;
  toOwnerResponse(
    dto?: { expansionFields?: UserField[] },
    account?: Account,
  ): Promise<OwnerResponse>;
  toAuthor(user?: User | User): Author;
}

export type UserStaticMethods = Model<UserDocument>;

export type User = UserDocument & UserMethods;

export const UserSchema = (
  SchemaFactory.createForClass(UserDocument) as MongooseSchema<
    UserDocument,
    UserStaticMethods,
    UserMethods
  >
)
  .index({ ownerAccount: 1 })
  .index({ displayId: 1 });
