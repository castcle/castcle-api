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
import { UserVerified } from '../models';
import { CastcleImage } from './common.dto';

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

class BlogPhoto {
  @ApiProperty()
  cover: CastcleImage | Url;

  @ApiProperty()
  contents: CastcleImage[] | Url[];
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
