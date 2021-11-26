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
import { ContentAggregator } from '../aggregator/content.aggregator';
import { Account } from './account.schema';
import { CastcleBase } from './base.schema';
import { signContentPayload } from './content.schema';
import { FeedItemPayload } from '../dtos/feedItem.dto';
import { ContentPayloadDto, ShortPayload } from '../dtos/content.dto';
import { EngagementDocument, EngagementType } from './engagement.schema';
import { GuestFeedItemPayloadItem } from '../dtos/guestFeedItem.dto';

export type FeedItemDocument = FeedItem & IFeedItem;

@Schema({ timestamps: true })
export class FeedItem extends CastcleBase {
  @Prop({
    required: true,
    type: Object
  })
  content: ContentPayloadDto;
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  })
  viewer: Account;
  @Prop({ required: true })
  seen: boolean;
  @Prop({ required: true })
  called: boolean;

  @Prop({
    required: true,
    type: Object
  })
  aggregator: ContentAggregator;
}

export const FeedItemSchema = SchemaFactory.createForClass(FeedItem);
FeedItemSchema.index({
  viewer: 1,
  'content.id': 1,
  'content.author.id': 1,
  'content.author.castcleId': 1
});
export interface IFeedItem extends mongoose.Document {
  toFeedItemPayload(engagements?: EngagementDocument[]): FeedItemPayload;
}

FeedItemSchema.methods.toFeedItemPayload = function (
  engagements: EngagementDocument[] = []
) {
  return {
    id: (this as FeedItemDocument)._id,
    feature: {
      id: 'feed',
      key: 'feature.feed',
      name: 'Feed',
      slug: 'feed'
    },
    circle: {
      id: 'for-you',
      key: 'circle.forYou',
      name: 'For You',
      slug: 'forYou'
    },
    type: 'content',
    payload: signContentPayload(
      (this as FeedItemDocument).content,
      engagements
    ),
    aggregator: {
      type: 'createTime'
    },
    createdAt: (this as FeedItemDocument).createdAt.toISOString(),
    updatedAt: (this as FeedItemDocument).updatedAt.toISOString()
  } as FeedItemPayload;
};

FeedItemSchema.methods.toFeedItemPayloadV2 = function (
  engagements: EngagementDocument[] = []
) {
  return {
    payload: {
      id: (this as FeedItemDocument).content.id,
      authorId: (this as FeedItemDocument).content.author.id,
      message: ((this as FeedItemDocument).content.payload as ShortPayload)
        .message,
      type: (this as FeedItemDocument).content.type,
      link: ((this as FeedItemDocument).content.payload as ShortPayload).link,
      photo: ((this as FeedItemDocument).content.payload as ShortPayload).photo,
      metrics: {
        likeCount: (this as FeedItemDocument).content.liked.count,
        commentCount: (this as FeedItemDocument).content.commented.count,
        quoteCount: 0,
        recastCount: (this as FeedItemDocument).content.recasted.count
      },
      participate: {
        liked: engagements.find((item) => item.type === EngagementType.Like)
          ? true
          : false,
        commented: engagements.find(
          (item) => item.type === EngagementType.Comment
        )
          ? true
          : false,
        quoted: engagements.find((item) => item.type === EngagementType.Quote)
          ? true
          : false,
        recasted: engagements.find(
          (item) => item.type === EngagementType.Recast
        )
          ? true
          : false
      },
      createdAt: (this as FeedItemDocument).content.createdAt,
      updatedAt: (this as FeedItemDocument).content.updatedAt
    }
  } as GuestFeedItemPayloadItem;
};

export const FeedItemSchemaFactory = (): mongoose.Schema<any> => {
  return FeedItemSchema;
};
