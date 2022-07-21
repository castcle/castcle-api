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
import {
  Author,
  BlogPayload,
  ContentPayloadDto,
  ContentPayloadItem,
  ImagePayload,
  ShortPayload,
} from '../dtos';
import { ReportingStatus } from '../models';
import { CastcleBase } from './base.schema';
import { ContentFarming } from './content-farming.schema';
import { Engagement } from './engagement.schema';

@Schema({ timestamps: true })
export class ContentDocument extends CastcleBase {
  @Prop({ required: true, type: Object })
  author: Author;

  @Prop({ required: true })
  type: string;

  @Prop({ type: Object })
  payload: ShortPayload | BlogPayload | ImagePayload;

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

  @Prop()
  isRecast?: boolean;

  @Prop()
  isQuote?: boolean;

  @Prop({ type: Object })
  originalPost?: ContentDocument;

  @Prop({ type: Array })
  farming?: ContentFarming[];

  @Prop({ type: String })
  reportedStatus?: ReportingStatus;

  @Prop({ type: String })
  reportedSubject?: string;
}

export class Content extends ContentDocument {
  /**
   * @returns {ContentPayloadDto} return payload that need to use in controller (not yet implement with engagement)
   */
  toContentPayload: (engagements?: Engagement[]) => ContentPayloadDto;
  toContentPayloadItem: (engagements?: Engagement[]) => ContentPayloadItem;
}

export const ContentSchema = SchemaFactory.createForClass<
  ContentDocument,
  Content
>(ContentDocument);

ContentSchema.index({ 'author.id': 1, 'author.castcleId': 1 });
ContentSchema.index({ 'originalPost._id': 1 });
