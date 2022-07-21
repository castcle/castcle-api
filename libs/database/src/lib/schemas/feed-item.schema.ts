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
import { SchemaTypes, Types } from 'mongoose';
import { FeedAggregator, FeedAnalytics } from '../models';
import { Account } from './account.schema';
import { CastcleBase } from './base.schema';
import { Content } from './content.schema';
import { Credential } from './credential.schema';

@Schema({ timestamps: true })
export class FeedItem extends CastcleBase {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true })
  author: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Content', index: true })
  content: Content;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Account' })
  viewer: Account;

  @Prop({ type: Object })
  calledAt?: Date;

  @Prop()
  seenAt?: Date;

  @Prop()
  offScreenAt?: Date;

  @Prop({ type: Object })
  offViewAt?: Date;

  @Prop({ type: Object })
  aggregator?: FeedAggregator;

  @Prop({ type: Object })
  analytics?: FeedAnalytics;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Credential' })
  seenCredential?: Credential;
}

export const FeedItemSchema = SchemaFactory.createForClass(FeedItem);

FeedItemSchema.index({ 'author.id': 1 });
FeedItemSchema.index({ 'content.id': 1 });
FeedItemSchema.index({ viewer: 1 });
