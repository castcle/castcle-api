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
import { TransformStringToEnum } from '@castcle-api/utils/commons';
import { Image } from '@castcle-api/utils/aws';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CastcleImage, SortBy } from './common.dto';
import { UserVerified } from '../models';
import { CastcleMeta, QueryOption } from './common.dto';
import { PaginationQuery } from './pagination.dto';

export class Url {
  @ApiProperty()
  image: string;
}

export enum LinkType {
  Other = 'other',
  Youtube = 'youtube',
}

export class Link {
  @ApiProperty()
  type: string | LinkType;

  @ApiProperty()
  url: string;

  @ApiProperty()
  image: string | CastcleImage;

  @ApiProperty()
  title?: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  imagePreview?: string | CastcleImage;
}

class BlogPhoto {
  @ApiProperty()
  cover: CastcleImage | Url;

  @ApiProperty()
  contents: CastcleImage[] | Url[];
}

class ShortPhoto {
  @ApiProperty()
  contents: CastcleImage[] | Url[];
}

export class ShortPayload {
  @ApiProperty()
  message?: string;
  @ApiProperty()
  photo?: ShortPhoto;
  @ApiProperty()
  link?: Link[];
}

export class ImagePayload {
  @ApiProperty()
  photo?: ShortPhoto;
}

export class BlogPayload {
  @ApiProperty()
  header: string;
  @ApiProperty()
  message: string;
  @ApiProperty()
  photo?: BlogPhoto;

  link?: Link[];
}

export class QuotePayload {
  source: any; //contain content._id
  message?: string;
  photo?: ShortPhoto;
}

export class RecastPayload {
  source: any; //contain content._id
  photo?: ShortPhoto;
}

class Feature {
  @ApiProperty()
  slug: 'feed';
  @ApiProperty()
  name: 'Feed';
  @ApiProperty()
  key: 'feature.feed';
}

class Participant {
  @ApiProperty()
  type: 'people' | 'page';
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
}

class Like {
  @ApiProperty()
  count: number;
  @ApiProperty()
  liked: boolean; // viewer like it or not
  @ApiProperty()
  participants: Participant[];
}

class Comment {
  @ApiProperty()
  count: number;
  @ApiProperty()
  commented: boolean;
  @ApiProperty()
  participants: Participant[];
}

class Recast {
  @ApiProperty()
  count: number;
  @ApiProperty()
  recasted: boolean;
  @ApiProperty()
  participants: Participant[];
}

export class Author {
  @ApiProperty()
  id: string;
  @ApiProperty()
  type: 'people' | 'page';
  @ApiProperty()
  castcleId: string;
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  avatar: CastcleImage | null;
  @ApiProperty()
  verified: UserVerified;

  constructor(author: Omit<Author, 'toIncludeUser'>) {
    this.avatar = author.avatar;
    this.castcleId = author.castcleId;
    this.displayName = author.displayName;
    this.id = author.id;
    this.type = author.type;
    this.verified = author.verified;
  }

  toIncludeUser = ({
    blocked,
    blocking,
    followed,
  }: Partial<IncludeUser> = {}): IncludeUser => ({
    ...this,
    blocked,
    blocking,
    followed,
  });
}

export class IncludeUser extends Author {
  blocked?: boolean;
  blocking?: boolean;
  followed?: boolean;
}

export class ContentPayloadDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: ContentType.Short | ContentType.Blog | ContentType.Image;

  @ApiProperty()
  payload: ShortPayload | BlogPayload | ImagePayload;

  @ApiProperty()
  feature: Feature;

  @ApiProperty()
  liked: Like;

  @ApiProperty()
  commented: Comment;

  @ApiProperty()
  recasted?: Recast;

  @ApiProperty()
  originalPost?: any;

  @ApiProperty()
  quoteCast?: ContentPayloadDto;

  @ApiProperty()
  author: Author;

  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  updatedAt: string;

  isQuote?: boolean;
  isRecast?: boolean;

  isSign?: boolean;
}

export class ContentPayloadItem {
  'id': string;
  'type': ContentType.Short | ContentType.Blog | ContentType.Image; // short, blog, image, shortClip, clip, live
  'message': string;
  'photo': {
    cover?: CastcleImage;
    contents: CastcleImage[];
  };
  'link': Link[];
  'referencedCasts'?: {
    type: 'quoted' | 'recasted'; // quoted, recasted
    id: string;
  };
  'metrics': {
    likeCount: number;
    commentCount: number;
    quoteCount: number;
    recastCount: number;
  };
  'participate': {
    liked: boolean;
    commented: boolean;
    quoted: boolean;
    recasted: boolean;
    reported: boolean;
  };
  authorId: string;
  'createdAt': string;
  'updatedAt': string;
}

export class SaveContentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  type: 'short' | 'blog' | 'image';

  @IsNotEmpty()
  @ApiProperty()
  payload: ShortPayload | BlogPayload | ImagePayload;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  castcleId: string;
}

export enum ContentType {
  Short = 'short',
  Blog = 'blog',
  Image = 'image',
}

export class CastcleContentQueryOptions extends QueryOption {
  type?: ContentType;
  sortBy: SortBy;
}

export const DEFAULT_CONTENT_QUERY_OPTIONS = {
  sortBy: {
    field: 'createdAt',
    type: 'desc',
  },
  maxResults: 25,
} as CastcleContentQueryOptions;

export class CastcleIncludes {
  users: Author[];
  casts?: ContentPayloadItem[];

  constructor({ casts, users }: CastcleIncludes) {
    this.casts = casts;
    this.users = CastcleIncludes.filterAuthors(users);
  }

  static filterAuthors(rawAuthors: Author[]) {
    const authors: Author[] = [];

    rawAuthors.forEach((author) => {
      const authorIndex = authors.findIndex(
        ({ id }) => String(author.id) == String(id)
      );

      if (authorIndex >= 0) return;

      author.avatar = author.avatar
        ? new Image(author.avatar).toSignUrls()
        : Configs.DefaultAvatarImages;

      authors.push(author);
    });

    return authors;
  }
}

export class ContentResponse {
  @ApiProperty()
  payload: ContentPayloadItem;
  @ApiProperty()
  includes: CastcleIncludes;
}

export class ContentsResponse {
  @ApiProperty()
  payload: ContentPayloadItem[];

  @ApiProperty()
  includes: CastcleIncludes;

  @ApiProperty()
  meta: CastcleMeta;
}

export class GetContentsDto extends PaginationQuery {
  @ApiProperty({
    enum: ContentType,
    required: false,
  })
  @TransformStringToEnum(ContentType)
  @IsOptional()
  type?: ContentType;
}
