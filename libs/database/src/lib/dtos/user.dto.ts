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
import { Expose, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PageVerified, SocialProvider, UserVerified, Wallet } from '../models';
import { CastcleImage, CastcleMeta, Pagination } from './common.dto';
import { PaginationQuery } from './pagination.dto';
import { Meta } from './response.dto';

class UserImage {
  @IsOptional()
  @IsString()
  avatar?: string | CastcleImage;

  @IsOptional()
  @IsString()
  cover?: string | CastcleImage;
}

export class UserModelImage {
  avatar?: CastcleImage;
  cover?: CastcleImage;
}

class Link {
  @ApiProperty()
  @IsString()
  facebook?: string;

  @ApiProperty()
  @IsString()
  twitter?: string;

  @ApiProperty()
  @IsString()
  youtube?: string;

  @ApiProperty()
  @IsString()
  medium?: string;

  @ApiProperty()
  @IsString()
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
  type: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email?: string;

  @ApiProperty()
  overview: string | null;

  @ApiProperty()
  dob: Date | null;

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
    facebook?: linkSocialDetail | null;
    twitter?: linkSocialDetail | null;
    google?: linkSocialDetail | null;
    apple?: linkSocialDetail | null;
  };

  @ApiProperty()
  syncSocial: syncSocialDetail[];

  @ApiProperty()
  casts: number;

  @ApiProperty()
  canUpdateCastcleId: boolean;

  contact?: ContactDto;
}

export class linkSocialDetail {
  socialId: string;
  displayName: string;
}

export class syncSocialDetail {
  id?: string;
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
  @IsString()
  @IsOptional()
  castcleId?: string;

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
  dob?: string;

  @ApiProperty()
  @IsOptional()
  images?: UserImage;

  @ApiProperty()
  @IsOptional()
  links?: Link;
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
  updatedAt: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  syncSocial: syncSocialDetail;

  @ApiProperty()
  casts: number;

  @ApiProperty()
  canUpdateCastcleId: boolean;

  contact?: UserContact;
}

export class UpdatePageDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty()
  @IsOptional()
  images?: {
    avatar?: string;
    cover?: string;
  };

  @ApiProperty()
  @IsString()
  @IsOptional()
  overview?: string;

  @ApiProperty()
  @IsOptional()
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
  pagination?: Pagination;
}

export class PageResponse {
  @ApiProperty()
  payload: PageResponseDto;
}

export class FollowResponse {
  @ApiProperty()
  payload: (UserResponseDto | PageResponseDto)[];

  @ApiProperty()
  meta: Meta;
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

  @ApiProperty()
  @IsString()
  @IsOptional()
  authToken?: string;
}

export class CreatePageSocialDto {
  @Type(() => SocialSyncDto)
  @ValidateNested({ each: true })
  payload: SocialSyncDto[];
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
  userName?: string;
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
}

export class GetUserParam {
  @ApiProperty()
  @IsString()
  userId: string;

  @Expose()
  @Transform(({ obj }) => obj.userId === 'me')
  isMe = () => this.userId === 'me';
}
export class ContactDto {
  @IsOptional()
  @IsString()
  countryCode?: string;
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class LinkSocialDetail {
  [key: string]: string;
}

export class UpdateUserDtoV2 {
  @IsOptional()
  @IsString()
  castcleId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsObject()
  contact?: ContactDto;

  @IsOptional()
  @IsObject()
  links?: LinkSocialDetail;

  @IsOptional()
  @IsObject()
  images?: UserImage;
}
export interface UserContact {
  countryCode?: string;
  phone?: string;
  email?: string;
}

export class UpdateModelUserDto {
  castcleId?: string;
  displayName?: string;
  overview?: string;
  dob?: string;
  links?: Link;
  contact?: ContactDto;
  images?: UserModelImage;
}

export class SyncSocialModelV2 {
  @IsOptional()
  facebook?: syncSocialDetail;

  @IsOptional()
  twitter?: syncSocialDetail;

  @IsOptional()
  youtube?: syncSocialDetail;

  @IsOptional()
  medium?: syncSocialDetail;
}

export class PagesResponseV2 {
  @ApiProperty()
  payload: PageResponseDto[];
}
