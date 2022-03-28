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
import {
  AcceptPlatform,
  PageResponseDto,
  UserResponseDto,
} from '@castcle-api/database/dtos';
import {
  AccountAuthenIdType,
  OtpObjective,
} from '@castcle-api/database/schemas';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
} from 'class-validator';
export class GuestLoginDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  deviceUUID: string;
}

export class CheckEmailExistDto {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  email: string;
}

export class LoginDto {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  username: string;
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  password: string;
}

export class SocialConnectDto {
  @IsNotEmpty()
  @IsEnum(AccountAuthenIdType)
  @ApiProperty()
  provider: AccountAuthenIdType;
  @IsString()
  @ApiProperty()
  socialId: string;
  @IsString()
  @IsOptional()
  @ApiProperty()
  displayName?: string;
  @IsString()
  @IsOptional()
  @ApiProperty()
  avatar?: string;
  @IsString()
  @IsOptional()
  @ApiProperty()
  email?: string;
  @IsString()
  @IsOptional()
  @ApiProperty()
  authToken?: string;
  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  referral?: string;
}

class RegisterPayload {
  @ApiProperty()
  email: string;
  @ApiProperty()
  password: string;
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  castcleId: string;
}

export class RegisterByEmailDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  channel: 'email';
  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  referral?: string;
  @IsNotEmpty()
  @ApiProperty()
  payload: RegisterPayload;
}

export class CheckIdExistDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  castcleId: string;
}

export class TokenResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}

export class CheckingResponse {
  @ApiProperty()
  message: string;

  @ApiProperty()
  payload: {
    exist: boolean;
  };
}

export class RefreshTokenResponse {
  @ApiProperty()
  profile: UserResponseDto;

  @ApiProperty({ type: PageResponseDto, isArray: true })
  pages: PageResponseDto[];

  @ApiProperty()
  accessToken: string;
}

class suggestCastcleIdPayload {
  @ApiProperty()
  suggestCastcleId: string;
}

export class SuggestCastcleIdResponse {
  @ApiProperty()
  payload: suggestCastcleIdPayload;
}

export class ChangePasswordBody {
  @ApiProperty()
  @IsEnum([OtpObjective.ChangePassword, OtpObjective.ForgotPassword])
  objective: OtpObjective;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

export class VerificationPasswordBody {
  @ApiProperty()
  @IsEnum([OtpObjective.ChangePassword])
  objective: OtpObjective;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export interface SocialConnect {
  socialId: string;
  email: string;
  name: string;
  provider: AccountAuthenIdType;
  profileImage: string;
  socialToken: string;
  socialSecretToken: string;
  avatar?: string;
}

export class OauthTokenResponse {
  @ApiProperty()
  oauthToken: string;
  @ApiProperty()
  oauthTokenSecret: string;
}

export class LoginResponse {
  @ApiProperty()
  profile: UserResponseDto;

  @ApiProperty({ type: PageResponseDto, isArray: true })
  pages: PageResponseDto[];

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}

export class ForgotPasswordPayload {
  @ApiProperty()
  email: string;

  @ApiProperty()
  countryCode: string;

  @ApiProperty()
  mobileNumber: string;

  @ApiProperty()
  recapchaToken: string;
}

export class OtpToken {
  @ApiProperty()
  recaptcha?: string;
}

export class RequestOtpDto {
  @ApiProperty()
  @IsEnum(OtpObjective)
  objective: OtpObjective;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty()
  @IsNotEmptyObject()
  payload: ForgotPasswordPayload;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  token?: OtpToken;
}

export class VerificationOtpDto extends RequestOtpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class otpResponse {
  @ApiProperty()
  objective: string;

  @ApiProperty()
  refCode: string;

  @ApiProperty()
  expiresTime: string;

  @ApiProperty()
  accessToken?: string;
}

export class RequestTokenDeviceDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  firebaseToken: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  uuid: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(AcceptPlatform)
  @ApiProperty()
  platform: AcceptPlatform;
}

export class SuggestCastcleIdDto {
  @ApiProperty()
  @IsString()
  displayName: string;
}
