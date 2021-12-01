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
import { CommentPayload } from '../dtos/comment.dto';
import { Image } from '@castcle-api/utils/aws';
import { Configs } from '@castcle-api/environments';
import { preCommentSave, postCommentSave } from '../hooks/comment.save';
import { CastcleBase } from './base.schema';
import { ContentDocument, User } from '.';
import { RevisionDocument } from './revision.schema';
import { EntityVisibility } from '../dtos';
import { EngagementDocument, EngagementType } from './engagement.schema';

export type CommentDocument = Comment & IComment;

export enum CommentType {
  Comment = 'comment',
  Reply = 'reply'
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
  type: string;

  @Prop()
  revisionCount: number;

  @Prop({ required: true, type: Object })
  targetRef: any; // dbRef of Content or comment

  @Prop({ type: Array })
  hashtags: any[];
}

interface IComment extends Document {
  toCommentPayload(
    commentModel: Model<CommentDocument>,
    engagements?: EngagementDocument[]
  ): Promise<CommentPayload>;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ 'author.id': 1, 'author.castcleId': 1 });
export const CommentSchemaFactory = (
  revisionModel: Model<RevisionDocument>,
  contentModel: Model<ContentDocument>
): mongoose.Schema<any> => {
  CommentSchema.methods.toCommentPayload = async function (
    commentModel: Model<CommentDocument>,
    engagements: EngagementDocument[] = []
  ) {
    //check if have revision
    const revisionCount = await revisionModel
      .count({
        objectRef: {
          $id: (this as CommentDocument)._id,
          $ref: 'comment'
        },
        'payload.author._id': (this as CommentDocument).author._id
      })
      .exec();

    const replies = await commentModel
      .find({
        type: CommentType.Reply,
        targetRef: { $id: this._id, $ref: 'comment' },
        visibility: EntityVisibility.Publish
      })
      .exec();
    const findEngagement = engagements
      ? engagements.find(
          (engagement) =>
            engagement.type === EngagementType.Like &&
            String(engagement.targetRef.$id) === this.id
        )
      : null;
    const payload: CommentPayload = {
      id: (this as CommentDocument)._id,
      message: (this as CommentDocument).message,
      /*like: {
        liked: findEngagement ? true : false,
        count: (this as CommentDocument).engagements.like.count,
        participant: [] //TODO !!! need to fix later on
      },*/
      metrics: {
        likeCount: (this as CommentDocument).engagements.like.count
      },
      participate: {
        liked: findEngagement ? true : false
      },
      author: {
        avatar: (this as CommentDocument).author.profile
          ? new Image(
              (this as CommentDocument).author.profile.images.avatar
            ).toSignUrls()
          : Configs.DefaultAvatarImages,
        castcleId: (this as CommentDocument).author.displayId,
        displayName: (this as CommentDocument).author.displayName,
        followed: false, //need to check with relationships,
        id: (this as CommentDocument).author._id,
        type: (this as CommentDocument).author.type,
        verified: (this as CommentDocument).author.verified
      },
      hasHistory: revisionCount > 1 ? true : false,
      reply: replies.map((r) => ({
        id: r._id,
        createdAt: r.createdAt.toISOString(),
        message: r.message,
        author: {
          avatar: r.author.profile
            ? new Image(r.author.profile.images.avatar).toSignUrls()
            : Configs.DefaultAvatarImages,
          castcleId: r.author.displayId,
          displayName: r.author.displayName,
          id: r.author._id,
          followed: false,
          verified: r.author.verified,
          type: r.author.type
        },
        /*like: {
          liked: engagements.find(
            (engagement) =>
              engagement.type === EngagementType.Like &&
              String(engagement.targetRef.$id) === r.id
          )
            ? true
            : false,
          count: r.engagements.like.count,
          participant: []
        }*/
        metrics: {
          likeCount: r.engagements.like.count
        },
        participate: {
          liked: engagements.find(
            (engagement) =>
              engagement.type === EngagementType.Like &&
              String(engagement.targetRef.$id) === r.id
          )
            ? true
            : false
        }
      })),
      createdAt: (this as CommentDocument).createdAt.toISOString(),
      updatedAt: (this as CommentDocument).updatedAt.toISOString()
    } as CommentPayload;

    return payload;
  };

  CommentSchema.pre('save', function (next) {
    preCommentSave(this as CommentDocument);
    next();
  });

  CommentSchema.post('save', async function (doc, next) {
    await postCommentSave(doc as CommentDocument, {
      revisionModel,
      contentModel
    });
    next();
  });
  return CommentSchema;
};
