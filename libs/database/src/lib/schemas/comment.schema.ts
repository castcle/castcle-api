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
import { preCommentSave, postCommentSave } from '../hooks/comment.save';
import { CastcleBase } from './base.schema';
import { ContentDocument, User } from '.';
import { RevisionDocument } from './revision.schema';

export type CommentDocument = Comment & Document;

export enum CommentType {
  Comment = 'comment',
  Reply = 'reply',
}
@Schema({ timestamps: true })
export class Comment extends CastcleBase {
  @Prop({ required: true, type: Object })
  author: User;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  engagements: {
    [engagementKey: string]: {
      count: number;
      refs: any[];
    };
  };

  @Prop({ required: true })
  type: CommentType;

  @Prop()
  revisionCount: number;

  @Prop({ required: true, type: Object })
  targetRef: any; // dbRef of Content or comment

  @Prop({ type: Array })
  hashtags: any[];
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ 'author.id': 1, 'author.castcleId': 1 });

export const CommentSchemaFactory = (
  revisionModel: Model<RevisionDocument>,
  contentModel: Model<ContentDocument>
): mongoose.Schema<any> => {
  CommentSchema.pre('save', function (next) {
    preCommentSave(this as CommentDocument);
    next();
  });

  CommentSchema.post('save', async function (doc, next) {
    await postCommentSave(doc as CommentDocument, {
      revisionModel,
      contentModel,
    });
    next();
  });

  return CommentSchema;
};
