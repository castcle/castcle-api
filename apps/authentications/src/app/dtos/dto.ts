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
import { PageResponseDto, UserResponseDto } from '@castcle-api/database/dtos';
import { AccountAuthenIdType } from '@castcle-api/database/schemas';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
  @ApiProperty({ enum: AccountAuthenIdType })
  provider: AccountAuthenIdType;
  @IsString()
  @ApiProperty()
  uid: string;
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

export class SuggestCastcleIdReponse {
  @ApiProperty()
  payload: suggestCastcleIdPayload;
}

export class ChangePasswordBody {
  @ApiProperty()
  objective: string;
  @ApiProperty()
  refCode: string;
  @ApiProperty()
  newPassword: string;
}

export class VerificationPasswordBody {
  @ApiProperty()
  objective: string;

  @ApiProperty()
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
}

export class RequestOtpDto {
  @ApiProperty()
  objective: string;

  @ApiProperty()
  channel: string;

  @ApiProperty()
  payload: ForgotPasswordPayload;
}
export class verificationOtpDto extends RequestOtpDto {
  @ApiProperty()
  refCode: string;

  @ApiProperty()
  otp: string;
}

export class otpResponse {
  @ApiProperty()
  objective: string;

  @ApiProperty()
  refCode: string;

  @ApiProperty()
  expiresTime: string;
}
