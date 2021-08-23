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
import { ApiProperty } from '@nestjs/swagger';
import { Pagination } from './common.dto';

class Url {
  @ApiProperty()
  url: string;
}

class Link {
  @ApiProperty()
  type: string;

  @ApiProperty()
  url: string;
}

class BlogPhoto {
  @ApiProperty()
  cover: Url;

  @ApiProperty()
  contents: Url[];
}

class ShortPhoto {
  @ApiProperty()
  contents: Url[];
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
  avatar: string | null;
  @ApiProperty()
  verified: boolean;
  @ApiProperty()
  followed: boolean;
}

export class ContentPayloadDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: 'short' | 'blog' | 'image';

  @ApiProperty()
  payload: ShortPayload | BlogPayload;

  @ApiProperty()
  feature: Feature;

  @ApiProperty()
  liked: Like;

  @ApiProperty()
  commented: Comment;

  @ApiProperty()
  recasted?: Recast;

  @ApiProperty()
  quoteCast?: ContentPayloadDto;

  @ApiProperty()
  author: Author;

  @ApiProperty()
  created: string;
  @ApiProperty()
  updated: string;
}

class AuthorDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  type: 'people' | 'page';
}

export class SaveContentDto {
  @ApiProperty()
  type: 'short' | 'blog' | 'image';

  @ApiProperty()
  payload: ShortPayload | BlogPayload | ImagePayload;

  @ApiProperty()
  author?: AuthorDto;
}

export enum ContentType {
  Short = 'short',
  Blog = 'blog',
  Recast = 'recast',
  Quote = 'quote'
}

export class CastcleQueryOptions {
  sortBy?: {
    field: string;
    type: 'desc' | 'asc';
  } = {
    field: 'updatedAt',
    type: 'desc'
  };
  type?: ContentType;
  page?: number = 1;
  limit?: number = 25;
}

export const DEFAULT_QUERY_OPTIONS = {
  sortBy: {
    field: 'updatedAt',
    type: 'desc'
  },
  type: ContentType.Short,
  page: 1,
  limit: 25
} as CastcleQueryOptions;

export class ContentResponse {
  @ApiProperty()
  payload: ContentPayloadDto;
}

export class ContentsResponse {
  @ApiProperty()
  payload: ContentPayloadDto[];

  @ApiProperty()
  pagination: Pagination;
}
