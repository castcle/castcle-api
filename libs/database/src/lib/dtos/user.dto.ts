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
import { CastcleImage } from '@castcle-api/utils/aws';
import { RemoveLeadingZero } from '@castcle-api/utils/commons';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsMobilePhone,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  AuthenticationProvider,
  OtpObjective,
  OwnerVerification,
  PublicVerification,
  SocialProvider,
  UserContact,
  UserImage,
  UserMobile,
  UserType,
  Wallet,
} from '../models';
import { CastcleMeta, Pagination } from './common.dto';
import { PaginationQuery } from './pagination.dto';
import { Meta } from './response.dto';

class UserImageDto {
  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  cover?: string;
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

export class SocialLinks {
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
  website?: string;
}

class Counter {
  @ApiProperty()
  count: number;
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
  links: SocialLinks;

  @ApiProperty()
  following: Counter;

  @ApiProperty()
  followers: Counter;

  @ApiProperty()
  verified: OwnerVerification;

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
  mobile: UserMobile;

  @ApiProperty()
  linkSocial: LinkedSocials;

  @ApiProperty()
  syncSocial: SocialSyncDto[] | SyncSocials;

  @ApiProperty()
  casts: number;

  @ApiProperty()
  canUpdateCastcleId: boolean;

  @ApiProperty()
  contact?: ContactDto;

  pdpa?: boolean;
}

type LinkedSocials = Partial<Record<AuthenticationProvider, LinkedSocial>>;

class LinkedSocial {
  socialId: string;
}

type SyncSocials = Partial<Record<SocialProvider, SocialSyncDto>>;

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
  @ValidateNested()
  @Type(() => UserImageDto)
  images?: UserImageDto;

  @ApiProperty()
  @IsOptional()
  links?: SocialLinks;
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
  images: UserImage;

  @ApiProperty()
  overview: string | null;

  @ApiProperty()
  links: SocialLinks;

  @ApiProperty()
  verified: PublicVerification;

  @ApiProperty()
  followers: Counter;

  @ApiProperty()
  following: Counter;

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
  syncSocial: SocialSyncDto;

  @ApiProperty()
  casts: number;

  @ApiProperty()
  canUpdateCastcleId: boolean;

  contact?: UserContact;

  pdpa?: boolean;
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
  links?: SocialLinks;
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
  links?: SocialLinks;
}

export class GetUserParam {
  @ApiProperty()
  @IsString()
  userId: string;

  @Expose()
  @Transform(({ obj }) => obj.userId === 'me')
  isMe = () => this.userId === 'me';
}

export class RemoveFarmParam extends GetUserParam {
  @ApiProperty()
  @IsString()
  farmingId: string;
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
  links?: SocialLinks;

  @IsOptional()
  @IsObject()
  images?: UserImageDto;
}

export class UpdateModelUserDto {
  castcleId?: string;
  displayName?: string;
  overview?: string;
  dob?: string;
  links?: SocialLinks;
  contact?: ContactDto;
  images?: UserImage;
}

export class PagesResponseV2 {
  @ApiProperty()
  payload: PageResponseDto[];
}

export class TargetIdParam extends GetUserParam {
  @IsString()
  @IsNotEmpty()
  targetCastcleId: string;
}

export class UpdateMobileDto {
  @IsEnum([OtpObjective.VERIFY_MOBILE])
  objective: OtpObjective;

  @IsString()
  refCode: string;

  @IsString()
  countryCode: string;

  @IsMobilePhone()
  @RemoveLeadingZero()
  mobileNumber: string;
}

export class PublicUserResponse {
  id: string;
  castcleId: string;
  displayName: string;
  type: UserType;
  email?: string;
  overview?: string;
  dob?: Date;
  images: UserImage;
  links: SocialLinks;
  verified: PublicVerification;
  followers: Counter;
  following: Counter;
  followed?: boolean;
  blocking?: boolean;
  blocked?: boolean;
  contact: ContactDto;
  casts: number;
  createdAt: Date;
  updatedAt: Date;
}

export class OwnerResponse extends PublicUserResponse {
  verified: OwnerVerification;
  canUpdateCastcleId: boolean;
  passwordNotSet: boolean;
  wallet?: Wallet;
  mobile?: UserMobile;
  linkSocial?: LinkedSocials;
  syncSocial?: SyncSocials;
  pdpa?: boolean;
  reportedStatus?: string;
  reportedSubject?: string;
}
