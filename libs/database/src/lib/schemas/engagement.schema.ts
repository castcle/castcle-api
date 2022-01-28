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
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { User } from './user.schema';
import { Comment } from './comment.schema';
import { Content } from './content.schema';
import { CastcleBase } from './base.schema';
import { EntityVisibility } from '../dtos/common.dto';

export enum EngagementType {
  Like = 'like',
  Recast = 'recast',
  Quote = 'quote',
  Comment = 'comment',
  Report = 'report',
}

@Schema({ timestamps: true })
export class Engagement extends CastcleBase {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ required: true, type: Object })
  targetRef: any;

  @Prop({ required: true })
  type: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId })
  itemId?: any; // for recast /quote
}

export const EngagementSchema = SchemaFactory.createForClass(Engagement);

export const EngagementSchemaFactory = (
  contentModel: Model<Content>,
  commentModel: Model<Comment>
): mongoose.Schema<any> => {
  EngagementSchema.post('save', async function (doc: Engagement, next) {
    const count = doc.visibility === EntityVisibility.Publish ? 1 : -1;
    const contentInc = { $inc: { [`engagements.${doc.type}.count`]: count } };

    if (['content', 'comment'].includes(doc.targetRef.$ref)) {
      await (doc.targetRef.$ref === 'content' ? contentModel : commentModel)
        .updateOne({ _id: doc.targetRef.$id }, contentInc)
        .exec();
    } else if (
      doc.targetRef.namespace === 'content' &&
      doc.visibility !== EntityVisibility.Publish
    ) {
      await contentModel
        .updateOne({ _id: doc.targetRef.oid }, contentInc)
        .exec();
    } else if (
      doc.targetRef.namespace === 'comment' &&
      doc.visibility !== EntityVisibility.Publish
    ) {
      await commentModel
        .updateOne({ _id: doc.targetRef.oid }, contentInc)
        .exec();
    }

    next();
  });

  EngagementSchema.post('remove', async (doc: Engagement, next) => {
    const contentInc = { $inc: { [`engagements.${doc.type}.count`]: -1 } };

    if (doc.targetRef.namespace === 'content') {
      await contentModel
        .updateOne({ _id: doc.targetRef.oid }, contentInc)
        .exec();
    } else {
      await commentModel
        .updateOne({ _id: doc.targetRef.oid }, contentInc)
        .exec();
    }

    next();
  });

  return EngagementSchema;
};
