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

import { Configs } from '@castcle-api/environments';
import { CastcleImage, Image } from '@castcle-api/utils/aws';
import { isString } from 'class-validator';
import { Model, Schema, Types } from 'mongoose';
import {
  BlogPayload,
  CastcleMetric,
  ContentPayloadDto,
  ContentPayloadItem,
  EntityVisibility,
  ShortPayload,
} from '../dtos';
import { EngagementType } from '../models';
import { Content, ContentDocument, ContentSchema } from './content.schema';
import { Engagement } from './engagement.schema';
import { Revision } from './revision.schema';

const engagementNameMap = {
  like: 'liked',
  comment: 'commented',
  quote: 'quoteCast',
  recast: 'recasted',
  seen: 'seen',
};

type ContentEngagement =
  | {
      [key: string]: boolean;
    }
  | {
      count: number;
      participant: {
        type: string;
        name: string;
        id: string;
      }[];
    };

const getEngagementObject = (
  doc: Content,
  engagementType: EngagementType,
  isEngage: boolean,
) => {
  //get owner relate engagement
  const engagementObject: ContentEngagement = {
    count: doc.engagements[engagementType]
      ? doc.engagements[engagementType].count
      : 0,
    participant: [],
  };
  engagementObject[engagementNameMap[engagementType]] = isEngage;
  return engagementObject;
};

export const signContentPayload = (
  payload: ContentPayloadDto,
  engagements: Engagement[] = [],
) => {
  for (const key in engagementNameMap) {
    const findEngagement = engagements
      ? engagements.find((engagement) => engagement.type === key)
      : null;
    payload[engagementNameMap[key]][engagementNameMap[key]] = findEngagement
      ? true
      : payload[engagementNameMap[key]][engagementNameMap[key]]
      ? payload[engagementNameMap[key]][engagementNameMap[key]]
      : false;
  }
  if (payload.payload?.photo?.contents) {
    payload.payload.photo.contents = (
      payload.payload.photo.contents as CastcleImage[]
    ).map((url) => {
      if (!url['isSign']) return new Image(url).toSignUrls();
      else return url;
    });
  }
  if (
    payload.payload.photo &&
    (payload.payload as BlogPayload).photo.cover &&
    !((payload.payload as BlogPayload).photo.cover as CastcleImage)['isSign']
  ) {
    (payload.payload as BlogPayload).photo.cover = new Image(
      (payload.payload as BlogPayload).photo.cover as CastcleImage,
    ).toSignUrls();
  }
  if ((payload.payload as BlogPayload).link) {
    (payload.payload as BlogPayload).link = (
      payload.payload as BlogPayload
    ).link.map((item) => {
      if (item.image && !item.image['isSign']) {
        item.image = new Image(item.image as CastcleImage).toSignUrls();
      }
      return item;
    });
  }
  if (
    payload.author &&
    payload.author.avatar &&
    !payload.author.avatar['isSign']
  )
    payload.author.avatar = new Image(payload.author.avatar).toSignUrls();
  else if (payload.author && !payload.author.avatar)
    payload.author.avatar = Configs.DefaultAvatarImages;

  if (payload.originalPost)
    payload.originalPost.author.avatar =
      payload.originalPost.author.avatar || Configs.DefaultAvatarImages;
  payload.isSign = true;
  return payload;
};

export const toUnsignedContentPayloadItem = (
  content: ContentDocument,
  engagements: Engagement[] = [],
  metrics?: CastcleMetric,
) => {
  const engage = engagements.filter(
    (engagement) =>
      String(engagement.targetRef.oid) === String(content.id) ||
      String(engagement.targetRef.oid) === String(content._id),
  );

  const result = {
    id: String(content._id),
    authorId: content.author.id,
    type: content.type,
    message: (content.payload as ShortPayload)?.message,
    link: (content.payload as ShortPayload)?.link,
    photo: (content.payload as ShortPayload)?.photo,
    metrics: metrics
      ? {
          likeCount: metrics.likeCount,
          commentCount: metrics.commentCount,
          quoteCount: metrics.quoteCount,
          recastCount: metrics.recastCount,
        }
      : {
          likeCount: content.engagements?.like?.count | 0,
          commentCount: content.engagements?.comment?.count | 0,
          quoteCount: content.engagements?.quote?.count | 0,
          recastCount: content.engagements?.recast?.count | 0,
        },
    participate: {
      liked: engage.some(({ type }) => type === EngagementType.Like),
      commented: engage.some(({ type }) => type === EngagementType.Comment),
      quoted: engage.some(({ type }) => type === EngagementType.Quote),
      recasted: engage.some(({ type }) => type === EngagementType.Recast),
      reported: engage?.some(({ type }) => type === EngagementType.Report),
    },

    createdAt: isString(content.createdAt)
      ? content.createdAt
      : content.createdAt.toISOString(),
    updatedAt: isString(content.updatedAt)
      ? content.updatedAt
      : content.updatedAt.toISOString(),
  } as ContentPayloadItem;
  if (content.isRecast || content.isQuote) {
    result.referencedCasts = {
      type: content.isRecast ? 'recasted' : 'quoted',
      id: content.originalPost._id as string,
    };
  }
  return result;
};

export const signedContentPayloadItem = (unsignedItem: ContentPayloadItem) => {
  if (unsignedItem.photo?.contents)
    unsignedItem.photo.contents = unsignedItem.photo.contents.map((item) =>
      new Image(item).toSignUrls(),
    );

  if (unsignedItem.photo?.cover)
    unsignedItem.photo.cover = new Image(unsignedItem.photo.cover).toSignUrls();

  if (unsignedItem.link)
    unsignedItem.link = unsignedItem.link.map((item) => {
      if (item.image) {
        return {
          ...item,
          image: (item.image = new Image(
            item.image as CastcleImage,
          ).toSignUrls()),
        };
      } else return item;
    });

  return unsignedItem;
};

export const toSignedContentPayloadItem = (
  content: ContentDocument,
  engagements: Engagement[] = [],
) =>
  signedContentPayloadItem(toUnsignedContentPayloadItem(content, engagements));

export const ContentSchemaFactory = (
  revisionModel: Model<Revision>,
): Schema<any> => {
  ContentSchema.methods.toContentPayloadItem = function (
    engagements: Engagement[] = [],
  ) {
    return signedContentPayloadItem(
      toUnsignedContentPayloadItem(this, engagements),
    );
  };

  ContentSchema.methods.toContentPayload = function (
    engagements: Engagement[] = [],
  ) {
    //Todo Need to implement recast quote cast later on
    const payload = {
      id: this._id,
      author: { ...this.author },
      payload: { ...this.payload },
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      type: this.type,
      feature: {
        slug: 'feed',
        key: 'feature.feed',
        name: 'Feed',
      },
      isQuote: this.isQuote,
      isRecast: this.isRecast,
    } as ContentPayloadDto;
    //get owner relate engagement
    for (const key in engagementNameMap) {
      const findEngagement = engagements
        ? engagements.find((engagement) => engagement.type === key)
        : null;
      payload[engagementNameMap[key]] = getEngagementObject(
        this,
        key as EngagementType,
        findEngagement ? true : false,
      );
    }
    //if it's recast or quotecast
    if (this.isRecast || this.isQuote) payload.originalPost = this.originalPost;
    return signContentPayload(payload);
  };

  ContentSchema.pre('save', function (next) {
    this.revisionCount = this.revisionCount ? this.revisionCount + 1 : 1;
    if (!this.visibility) this.visibility = EntityVisibility.Publish;
    if (!this.engagements) {
      this.engagements = {
        like: { count: 0, refs: [] },
        comment: { count: 0, refs: [] },
        recast: { count: 0, refs: [] },
        quote: { count: 0, refs: [] },
      };
    }

    next();
  });

  ContentSchema.post('save', async function (doc, next) {
    await new revisionModel({
      objectRef: { $ref: 'content', $id: Types.ObjectId(doc._id) },
      payload: doc,
    }).save();

    next();
  });

  return ContentSchema;
};
