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

class UserImage {
  @ApiProperty()
  avatar: string;
  @ApiProperty()
  cover: string;
}

class Link {
  @ApiProperty()
  facebook?: string;

  @ApiProperty()
  twitter?: string;

  @ApiProperty()
  youtube?: string;

  @ApiProperty()
  medium?: string;

  @ApiProperty()
  website?: string | null;
}

class Counter {
  @ApiProperty()
  count: number;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  castcleId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  overview: string | null;

  @ApiProperty()
  dob: string | null;

  @ApiProperty()
  images: UserImage;

  @ApiProperty()
  links: Link;

  @ApiProperty()
  following: Counter;

  @ApiProperty()
  followers: Counter;

  @ApiProperty()
  verified: boolean;

  @ApiProperty()
  followed: boolean;
}

export class UpdateUserDto {
  @ApiProperty()
  overview?: string;

  @ApiProperty()
  dob?: string;

  @ApiProperty()
  images?: UserImage;

  @ApiProperty()
  links?: Link;
}

export class PageDto {
  @ApiProperty()
  username: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  cover: string;
}

export class PageResponseDto {
  @ApiProperty()
  username: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  cover: string;

  @ApiProperty()
  updated: string;

  @ApiProperty()
  created: string;
}

export class UpdatePageDto {
  @ApiProperty()
  displayName?: string;

  @ApiProperty()
  avatar?: string;

  @ApiProperty()
  cover?: string;
}

export class PagesResponse {
  @ApiProperty()
  payload: PageResponseDto[];

  @ApiProperty()
  pagination: Pagination;
}

export class PageResponse {
  @ApiProperty()
  payload: PageResponseDto;
}
