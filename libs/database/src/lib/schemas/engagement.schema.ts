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
import { Document, Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { User } from './user.schema';
import { Comment } from './comment.schema';
import { Content, ContentDocument } from './content.schema';
import { CastcleBase } from './base.schema';

export type EngagementDocument = Engagement & Document;

export enum EngagementType {
  Like = 'like',
  Recast = 'recast',
  Quote = 'quote',
  Comment = 'comment'
}

@Schema({ timestamps: true })
export class Engagement extends CastcleBase {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ required: true, type: Object })
  targetRef: any;

  @Prop({ required: true, type: Object })
  target: Comment | Content | any;

  @Prop({ required: true })
  type: string;
}

export const EngagementSchema = SchemaFactory.createForClass(Engagement);

export const EngagementSchemaFactory = (
  contentModel: Model<ContentDocument>
): mongoose.Schema<any> => {
  EngagementSchema.post('save', (doc, next) => {
    const incEngagment: { [key: string]: number } = {};
    incEngagment[`engagement.${(doc as EngagementDocument).type}`] = 1;
    contentModel.updateOne(
      { _id: (doc as EngagementDocument).targetRef.$id },
      {
        $inc: incEngagment
      }
    );
  });
  EngagementSchema.post('deleteOne', (doc, next) => {
    const incEngagment: { [key: string]: number } = {};
    incEngagment[`engagement.${(doc as EngagementDocument).type}`] = -1;
    contentModel.updateOne(
      { _id: (doc as EngagementDocument).targetRef.$id },
      {
        $inc: incEngagment
      }
    );
  });
  return EngagementSchema;
};
