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
import { SocialSyncDto } from '../dtos/user.dto';
import { SocialProvider } from '../models';
import { Author, AuthorSchema } from './author.schema';
import { CastcleBase } from './base.schema';

@Schema({ timestamps: true })
class SocialSyncDocument extends CastcleBase {
  @Prop({ required: true, type: AuthorSchema })
  author: Author;

  @Prop({ required: true, type: String })
  provider: SocialProvider;

  @Prop({ required: true })
  socialId: string;

  @Prop()
  userName?: string;

  @Prop()
  displayName?: string;

  @Prop()
  avatar?: string;

  @Prop({ default: false })
  active: boolean;

  @Prop()
  latestSyncId?: string;

  @Prop()
  latestSyncDate?: Date;

  @Prop({ default: false })
  autoPost: boolean;
}

export const SocialSyncSchema =
  SchemaFactory.createForClass(SocialSyncDocument);

export class SocialSync extends SocialSyncDocument {
  toSocialSyncPayload: () => SocialSyncDto;
}

SocialSyncSchema.methods.toSocialSyncPayload = function () {
  return {
    socialId: this.socialId,
    username: this.userName,
    displayName: this.displayName,
    avatar: this.avatar,
    active: this.active,
  } as SocialSyncDto;
};
