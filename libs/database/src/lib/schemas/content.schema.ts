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
import { Account } from '../schemas/account.schema';
import {
  ContentPayloadDto,
  ShortPayload,
  ContentType,
  BlogPayload,
  Author
} from '../dtos/content.dto';
import { CastcleBase } from './base.schema';
import { RevisionDocument } from './revision.schema';
import { EngagementDocument } from './engagement.schema';
import { EntityVisibility } from '../dtos/common.dto';

//TODO: !!!  need to revise this
export interface RecastPayload {
  source: Content;
}

export interface QuotePayload {
  source: Content;
  content: string;
}

export type ContentDocument = Content & IContent;

@Schema({ timestamps: true })
export class Content extends CastcleBase {
  @Prop({ required: true, type: Object })
  author: Author;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true, type: Object })
  payload: ShortPayload | BlogPayload | RecastPayload | QuotePayload;

  @Prop({ type: Object })
  engagements: {
    [engagementKey: string]: {
      count: number;
      refs: any[];
    };
  };

  @Prop({ required: true })
  revisionCount: number;

  @Prop({ type: Array })
  hashtags: any[];
}

interface IContent extends Document {
  /**
   * @returns {ContentPayloadDto} return payload that need to use in controller (not yet implement with engagement)
   */
  toContentPayload(): ContentPayloadDto;
}

export const ContentSchema = SchemaFactory.createForClass(Content);

ContentSchema.methods.toContentPayload = function () {
  //Todo Need to implement recast quote cast later on
  return {
    id: (this as ContentDocument)._id,
    author: (this as ContentDocument).author,
    commented: {
      commented: false, //TODO !!! need to update after implement with engagement
      count:
        (this as ContentDocument).engagements &&
        (this as ContentDocument).engagements['comment']
          ? (this as ContentDocument).engagements['comment'].count
          : 0,
      participants: []
    },
    payload: (this as ContentDocument).payload,
    created: (this as ContentDocument).createdAt.toISOString(),
    updated: (this as ContentDocument).updatedAt.toISOString(),
    liked: {
      liked: false,
      count:
        (this as ContentDocument).engagements &&
        (this as ContentDocument).engagements['like']
          ? (this as ContentDocument).engagements['like'].count
          : 0,
      participants: []
    },
    type: (this as ContentDocument).type,
    feature: {
      slug: 'feed',
      key: 'feature.feed',
      name: 'Feed'
    }
  } as ContentPayloadDto;
};

const removeEngagementAggregateIfDeleted = async (
  doc: ContentDocument,
  engagementModel: Model<EngagementDocument>
) => {
  let payload: QuotePayload | RecastPayload;
  if (doc.type === ContentType.Recast || doc.type === ContentType.Quote) {
    payload =
      doc.type === ContentType.Recast
        ? (doc.payload as RecastPayload)
        : (doc.payload as QuotePayload);
  }
};

export const ContentSchemaFactory = (
  revisionModel: Model<RevisionDocument>
): mongoose.Schema<any> => {
  ContentSchema.pre('save', function (next) {
    //defualt is publish
    (this as ContentDocument).visibility = (this as ContentDocument).visibility
      ? (this as ContentDocument).visibility
      : EntityVisibility.Publish;
    (this as ContentDocument).revisionCount = (this as ContentDocument)
      .revisionCount
      ? (this as ContentDocument).revisionCount + 1
      : 1;
    if (!(this as ContentDocument).engagements) {
      (this as ContentDocument).engagements = {
        like: {
          count: 0,
          refs: []
        },
        comment: {
          count: 0,
          refs: []
        }
      };
    }
    next();
  });
  ContentSchema.post('save', async function (doc, next) {
    const session = await revisionModel.startSession();
    session.withTransaction(async () => {
      //update revision
      const newRevison = new revisionModel({
        objectRef: {
          $ref: 'content',
          $id: mongoose.Types.ObjectId((doc as ContentDocument)._id)
        },
        payload: doc as Content
      });
      const result = await newRevison.save();
      //update engagement aggr if
    });
    session.endSession();
    next();
  });
  return ContentSchema;
};
