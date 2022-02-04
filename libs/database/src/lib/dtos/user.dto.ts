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
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PageVerified, SocialProvider, UserVerified } from '../models';
import { Wallet } from '../models/wallet.model';
import { CastcleImage, CastcleMeta, Pagination } from './common.dto';
import { PaginationQuery } from './pagination.dto';

class UserImage {
  @ApiProperty()
  avatar: string | CastcleImage;
  @ApiProperty()
  cover: string | CastcleImage;
}

export class UserModelImage {
  avatar?: CastcleImage;
  cover?: CastcleImage;
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
  displayName: string;

  @ApiProperty()
  email?: string;

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
  verified: UserVerified;

  @ApiProperty()
  followed: boolean;

  @ApiProperty()
  blocked: boolean;

  @ApiProperty()
  blocking: boolean;

  @ApiProperty()
  passwordNotSet: boolean;

  @ApiProperty()
  wallet: Wallet;

  @ApiProperty()
  mobile: {
    countryCode: string;
    number: string;
  };

  @ApiProperty()
  linkSocial: {
    facebook: linkSocialDetail | null;
    twitter: linkSocialDetail | null;
    google: linkSocialDetail | null;
    apple: linkSocialDetail | null;
  };

  @ApiProperty()
  syncSocial: syncSocialDetail[];
}

export class linkSocialDetail {
  socialId: string;
  displayName: string;
}

export class syncSocialDetail {
  provider: string;
  socialId: string;
  userName: string;
  displayName: string;
  avatar: string;
  active: boolean;
  autoPost: boolean;
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

export class UpdateModelUserDto {
  overview?: string;
  dob?: string;
  links?: Link;
  images?: UserModelImage;
}

export class PageDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  castcleId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  displayName: string;
}

export class PageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  castcleId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  images: {
    avatar: CastcleImage;
    cover: CastcleImage;
  };

  @ApiProperty()
  overview: string | null;

  @ApiProperty()
  links: {
    facebook: string | null;
    twitter: string | null;
    youtube: string | null;
    medium: string | null;
    website: string | null;
  };

  @ApiProperty()
  verified: PageVerified;

  @ApiProperty()
  followers: {
    count: number;
  };

  @ApiProperty()
  following: {
    count: number;
  };

  @ApiProperty()
  followed: boolean;

  @ApiProperty()
  blocked: boolean;

  @ApiProperty()
  blocking: boolean;

  @ApiProperty()
  socialSyncs: boolean;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty()
  createdAt: string;
}

export class UpdatePageDto {
  @ApiProperty()
  displayName?: string;

  @ApiProperty()
  images?: {
    avatar?: string;
    cover?: string;
  };

  @ApiProperty()
  overview?: string;

  @ApiProperty()
  links?: {
    facebook?: string | null;
    twitter?: string | null;
    youtube?: string | null;
    medium?: string | null;
    website?: string | null;
  };
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

export class FollowResponse {
  @ApiProperty()
  payload: (UserResponseDto | PageResponseDto)[];

  @ApiProperty()
  pagination: Pagination;
}

export class SocialSyncPageRequestDto {
  payload: SocialSyncDto[];
}
export class SocialSyncDto {
  @ApiProperty()
  @IsString()
  castcleId?: string;

  @ApiProperty()
  @IsEnum(SocialProvider)
  provider?: SocialProvider;

  @ApiProperty()
  @IsString()
  socialId: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  overview?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  cover?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  link?: string;

  @ApiProperty()
  @IsBoolean()
  active?: boolean;

  @ApiProperty()
  @IsBoolean()
  autoPost?: boolean;
}

export class SocialSyncDeleteDto {
  @ApiProperty()
  @IsString()
  castcleId?: string;

  @ApiProperty()
  @IsEnum(SocialProvider)
  provider?: SocialProvider;

  @ApiProperty()
  @IsString()
  socialId: string;
}

export class GetSearchUsersDto extends PaginationQuery {
  @IsString()
  @IsNotEmpty()
  keyword: string;
}

export class SuggestToFollowResponseDto {
  payload: (UserResponseDto | PageResponseDto)[];
  meta: CastcleMeta;
}
export class SocialPageDto {
  castcleId: string;
  displayName: string;
  overview?: string;
  avatar?: CastcleImage;
  cover?: CastcleImage;
  links?: {
    facebook?: string | null;
    twitter?: string | null;
    youtube?: string | null;
    medium?: string | null;
    website?: string | null;
  };
  socialSyncs?: boolean;
}
