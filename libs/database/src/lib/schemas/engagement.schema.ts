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
import { Account } from './account.schema';
import { CastcleBase } from './base.schema';
import { User } from './user.schema';

@Schema({ timestamps: true })
export class Engagement extends CastcleBase {
  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'User',
    index: true,
  })
  user: User;

  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'Account',
    index: true,
  })
  account: Account;

  @Prop({ required: true, type: Object, index: true })
  targetRef: any;

  @Prop({ required: true, index: true })
  type: string;

  /** for recast or quote */
  @Prop({ type: SchemaTypes.ObjectId, index: true })
  itemId?: any;
}

export const EngagementSchema = SchemaFactory.createForClass(Engagement);

EngagementSchema.index(
  { targetRef: -1, user: -1, visibility: -1 },
  { background: true },
);
