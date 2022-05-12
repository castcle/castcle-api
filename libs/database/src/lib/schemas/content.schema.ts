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
import { Image } from '@castcle-api/utils/aws';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { CastcleImage, CastcleMetric } from '../dtos/common.dto';
import {
  Author,
  BlogPayload,
  ContentPayloadDto,
  ContentPayloadItem,
  ImagePayload,
  ShortPayload,
} from '../dtos/content.dto';
import { postContentSave, preContentSave } from '../hooks/content.save';
import { EngagementType } from '../models';
import { CastcleBase } from './base.schema';
import { ContentFarming } from './content-farming.schema';
import { Engagement } from './engagement.schema';
import { FeedItem } from './feed-item.schema';
import { Relationship } from './relationship.schema';
import { Revision } from './revision.schema';
import { User } from './user.schema';

const engagementNameMap = {
  like: 'liked',
  comment: 'commented',
  quote: 'quoteCast',
  recast: 'recasted',
  seen: 'seen',
};

/**
 * return engagement object such is liked, comment quoteCast recast so we have the exact amount of time they do
 * @param doc
 * @param engagementType
 * @param userId
 * @returns
 */
const getEngagementObject = (
  doc: ContentDocument,
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

@Schema({ timestamps: true })
class ContentDocument extends CastcleBase {
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
}

export class Content extends ContentDocument {
  /**
   * @returns {ContentPayloadDto} return payload that need to use in controller (not yet implement with engagement)
   */
  toContentPayload: (engagements?: Engagement[]) => ContentPayloadDto;
  toContentPayloadItem: (engagements?: Engagement[]) => ContentPayloadItem;
  toUnsignedContentPayload: (engagements?: Engagement[]) => ContentPayloadDto;
  toContent: () => Content;
}

export const signContentPayload = (
  payload: ContentPayloadDto,
  engagements: Engagement[] = [],
) => {
  console.debug('----SIGN CONTENT---');
  console.debug(payload);
  for (const key in engagementNameMap) {
    console.debug(key, engagementNameMap[key], engagements);
    const findEngagement = engagements
      ? engagements.find((engagement) => engagement.type === key)
      : null;
    console.debug(findEngagement);
    payload[engagementNameMap[key]][engagementNameMap[key]] = findEngagement
      ? true
      : payload[engagementNameMap[key]][engagementNameMap[key]]
      ? payload[engagementNameMap[key]][engagementNameMap[key]]
      : false;
  }
  if (payload.payload?.photo?.contents) {
    payload.payload.photo.contents = (
      payload.payload.photo.contents as CastcleImage[]
    ).map((url: CastcleImage) => {
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
  console.debug('afterSign', JSON.stringify(payload));
  return payload;
};

export const transformContentPayloadToV2 = (
  content: ContentPayloadDto,
  engagements: Engagement[],
) => {
  const contentPayloadItem = {
    id: content.id,
    authorId: content.author.id,
    message: (content.payload as ShortPayload)?.message,
    type: content.type,
    link: (content.payload as ShortPayload)?.link,
    photo: (content.payload as ShortPayload)?.photo,
    metrics: {
      likeCount: content.liked.count,
      commentCount: content.commented.count,
      quoteCount: 0,
      recastCount: content.recasted.count,
    },
    participate: {
      liked: engagements.find((item) => item.type === EngagementType.Like)
        ? true
        : false,
      commented: engagements.find(
        (item) => item.type === EngagementType.Comment,
      )
        ? true
        : false,
      quoted: engagements.find((item) => item.type === EngagementType.Quote)
        ? true
        : false,
      recasted: engagements.find((item) => item.type === EngagementType.Recast)
        ? true
        : false,
    },
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  } as ContentPayloadItem;
  if (content.isRecast || content.isQuote) {
    contentPayloadItem.referencedCasts = {
      type: content.isRecast ? 'recasted' : 'quoted',
      id: content.originalPost._id as string,
    };
  }
  return contentPayloadItem;
};

export const toUnsignedContentPayloadItem = (
  content: Content | ContentDocument,
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
      ? metrics
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

    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString(),
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
        item.image = new Image(item.image as CastcleImage).toSignUrls();
      } else return item;
    });

  return unsignedItem;
};

export const toSignedContentPayloadItem = (
  content: Content | ContentDocument,
  engagements: Engagement[] = [],
) =>
  signedContentPayloadItem(toUnsignedContentPayloadItem(content, engagements));

export const ContentSchema = SchemaFactory.createForClass<
  ContentDocument,
  Content
>(ContentDocument);

ContentSchema.index({ 'author.id': 1, 'author.castcleId': 1 });
ContentSchema.index({ 'originalPost._id': 1 });
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

export const ContentSchemaFactory = (
  revisionModel: Model<Revision>,
  feedItemModel: Model<FeedItem>,
  userModel: Model<User>,
  relationshipModel: Model<Relationship>,
): mongoose.Schema<any> => {
  ContentSchema.methods.toContent = function () {
    return new ContentDocument({ author: this.author });
  };

  ContentSchema.methods.toUnsignedContentPayload = function (
    engagements: Engagement[] = [],
  ) {
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
    return payload;
  };

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
    console.debug('--signContent', payload);
    return signContentPayload(payload);
  };

  ContentSchema.pre('save', async function (next) {
    //default is publish
    await preContentSave(this as Content);

    next();
  });
  ContentSchema.post('save', async function (doc, next) {
    await postContentSave(doc as Content, {
      revisionModel,
      feedItemModel,
      userModel,
      relationshipModel,
    });
    next();
  });
  return ContentSchema;
};
