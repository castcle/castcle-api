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
import {
  ContentPayloadDto,
  ShortPayload,
  BlogPayload,
  Author,
  ImagePayload,
  ContentPayloadItem,
} from '../dtos/content.dto';
import { CastcleBase } from './base.schema';
import { RevisionDocument } from './revision.schema';
import { EngagementDocument, EngagementType } from './engagement.schema';
import { CastcleImage } from '../dtos/common.dto';
import { postContentSave, preContentSave } from '../hooks/content.save';
import { UserDocument } from '.';
import { RelationshipDocument } from './relationship.schema';
import { FeedItemDocument } from './feedItem.schema';
import { Image } from '@castcle-api/utils/aws';
import { Configs } from '@castcle-api/environments';

//TODO: !!!  need to revise this
export interface RecastPayload {
  source: Content;
}

export interface QuotePayload {
  source: Content;
  content: string;
}

const engagementNameMap = {
  like: 'liked',
  comment: 'commented',
  quote: 'quoteCast',
  recast: 'recasted',
};

/**
 * return engagement object such is liked, comment quoteCast recast so we ahve the exact amount of time they do
 * @param doc
 * @param engagementType
 * @param userId
 * @returns
 */
const getEngagementObject = (
  doc: ContentDocument,
  engagementType: EngagementType,
  isEngage: boolean
) => {
  //get owner relate enagement
  const engagementObject: ContentEngagement = {
    count: doc.engagements[engagementType]
      ? doc.engagements[engagementType].count
      : 0,
    participant: [],
  };
  engagementObject[engagementNameMap[engagementType]] = isEngage;
  return engagementObject;
};

export type ContentDocument = Content & IContent;

@Schema({ timestamps: true })
export class Content extends CastcleBase {
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
  originalPost?: Content;
}

interface IContent extends Document {
  /**
   * @returns {ContentPayloadDto} return payload that need to use in controller (not yet implement with engagement)
   */
  toContentPayload(engagements?: EngagementDocument[]): ContentPayloadDto;
  toContentPayloadItem(engagements?: EngagementDocument[]): ContentPayloadItem;
  toUnsignedContentPayload(
    engagements?: EngagementDocument[]
  ): ContentPayloadDto;
  toContent(): Content;
}

export const signContentPayload = (
  payload: ContentPayloadDto,
  engagements: EngagementDocument[] = []
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
  if (
    payload.payload &&
    payload.payload.photo &&
    payload.payload.photo.contents
  ) {
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
      (payload.payload as BlogPayload).photo.cover as CastcleImage
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
  engagements: EngagementDocument[]
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
        (item) => item.type === EngagementType.Comment
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
  content: ContentDocument | Content,
  engagements: EngagementDocument[] = []
) => {
  const result = {
    id: String(content._id),
    authorId: content.author.id,
    type: content.type,
    message: (content.payload as ShortPayload)?.message,
    link: (content.payload as ShortPayload)?.link,
    photo: (content.payload as ShortPayload)?.photo,

    metrics: {
      likeCount: content.engagements?.like?.count | 0,
      commentCount: content.engagements?.comment?.count | 0,
      quoteCount: content.engagements?.quote?.count | 0,
      recastCount: content.engagements?.recast?.count | 0,
    },
    participate: {
      liked: engagements.some(({ type }) => type === EngagementType.Like),
      commented: engagements.some(
        ({ type }) => type === EngagementType.Comment
      ),
      quoted: engagements.some(({ type }) => type === EngagementType.Quote),
      recasted: engagements.some(({ type }) => type === EngagementType.Recast),
      reported: engagements.some(({ type }) => type === EngagementType.Report),
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
      new Image(item).toSignUrls()
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
  content: ContentDocument | Content,
  engagements: EngagementDocument[] = []
) =>
  signedContentPayloadItem(toUnsignedContentPayloadItem(content, engagements));

export const ContentSchema = SchemaFactory.createForClass(Content);
ContentSchema.index({ 'author.id': 1, 'author.castcleId': 1 });
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
  revisionModel: Model<RevisionDocument>,
  feedItemModel: Model<FeedItemDocument>,
  userModel: Model<UserDocument>,
  relationshipModel: Model<RelationshipDocument>
): mongoose.Schema<any> => {
  ContentSchema.methods.toContent = function () {
    const t = new Content();
    t.author = (this as ContentDocument).author;
    return t;
  };

  ContentSchema.methods.toUnsignedContentPayload = function (
    engagements: EngagementDocument[] = []
  ) {
    const payload = {
      id: (this as ContentDocument)._id,
      author: { ...(this as ContentDocument).author },
      payload: { ...(this as ContentDocument).payload },
      createdAt: (this as ContentDocument).createdAt.toISOString(),
      updatedAt: (this as ContentDocument).updatedAt.toISOString(),
      type: (this as ContentDocument).type,
      feature: {
        slug: 'feed',
        key: 'feature.feed',
        name: 'Feed',
      },
    } as ContentPayloadDto;
    //get owner relate enagement
    for (const key in engagementNameMap) {
      const findEngagement = engagements
        ? engagements.find((engagement) => engagement.type === key)
        : null;
      payload[engagementNameMap[key]] = getEngagementObject(
        this as ContentDocument,
        key as EngagementType,
        findEngagement ? true : false
      );
    }
    //if it's recast or quotecast
    if ((this as ContentDocument).isRecast || (this as ContentDocument).isQuote)
      payload.originalPost = (this as ContentDocument).originalPost;
    return payload;
  };

  ContentSchema.methods.toContentPayloadItem = function (
    engagements: EngagementDocument[] = []
  ) {
    return signedContentPayloadItem(
      toUnsignedContentPayloadItem(this as ContentDocument, engagements)
    );
  };

  ContentSchema.methods.toContentPayload = function (
    engagements: EngagementDocument[] = []
  ) {
    //Todo Need to implement recast quote cast later on
    const payload = {
      id: (this as ContentDocument)._id,
      author: { ...(this as ContentDocument).author },
      payload: { ...(this as ContentDocument).payload },
      createdAt: (this as ContentDocument).createdAt.toISOString(),
      updatedAt: (this as ContentDocument).updatedAt.toISOString(),
      type: (this as ContentDocument).type,
      feature: {
        slug: 'feed',
        key: 'feature.feed',
        name: 'Feed',
      },
      isQuote: (this as ContentDocument).isQuote,
      isRecast: (this as ContentDocument).isRecast,
    } as ContentPayloadDto;
    //get owner relate enagement
    for (const key in engagementNameMap) {
      const findEngagement = engagements
        ? engagements.find((engagement) => engagement.type === key)
        : null;
      payload[engagementNameMap[key]] = getEngagementObject(
        this as ContentDocument,
        key as EngagementType,
        findEngagement ? true : false
      );
    }
    //if it's recast or quotecast
    if ((this as ContentDocument).isRecast || (this as ContentDocument).isQuote)
      payload.originalPost = (this as ContentDocument).originalPost;
    console.debug('--signContent', payload);
    return signContentPayload(payload);
  };

  ContentSchema.pre('save', async function (next) {
    //defualt is publish
    await preContentSave(this as ContentDocument);

    next();
  });
  ContentSchema.post('save', async function (doc, next) {
    await postContentSave(doc as ContentDocument, {
      revisionModel,
      feedItemModel,
      userModel,
      relationshipModel,
    });
    next();
  });
  return ContentSchema;
};
