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
import { AccountAuthenIdType } from '@castcle-api/database/schemas';
import { ApiProperty } from '@nestjs/swagger';
export class GuestLoginDto {
  @ApiProperty()
  deviceUUID: string;
}

export class CheckEmailExistDto {
  @ApiProperty()
  email: string;
}

export class LoginDto {
  @ApiProperty()
  username: string;
  @ApiProperty()
  password: string;
}

export class SocialConnectInfo {
  @ApiProperty()
  authToken?: string;
  @ApiProperty()
  authVerifierToken?: string;
  @ApiProperty()
  id?: string;
  @ApiProperty()
  first_name?: string;
  @ApiProperty()
  last_name?: string;
  @ApiProperty()
  username?: string;
  @ApiProperty()
  photo_url?: string;
  @ApiProperty()
  auth_date?: string;
  @ApiProperty()
  hash?: string;
}

export class SocialConnectDto {
  @ApiProperty({ enum: AccountAuthenIdType })
  provider: AccountAuthenIdType;
  @ApiProperty({ type: SocialConnectInfo, isArray: false })
  payload: SocialConnectInfo;
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
  @ApiProperty()
  channel: 'email';
  @ApiProperty()
  payload: RegisterPayload;
}

export class CheckIdExistDto {
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
  refCode: string;
  @ApiProperty()
  newPassword: string;
}

export class VerificationPasswordBody {
  @ApiProperty()
  password: string;
}

export class VerificationPasswordResponse {
  @ApiProperty()
  refCode: string;
  @ApiProperty()
  expiresTime: string;
}

export interface SocialConnect {
  socialId: string;
  email: string;
  name: string;
  provider: AccountAuthenIdType;
  profileImage: string;
  socialToken: string;
}
export class UserPayload {
  @ApiProperty()
  email: string;

  @ApiProperty()
  countryCode: string;

  @ApiProperty()
  mobileNumber: string;
}

export class ForgotPasswordRequestOtpDto {
  @ApiProperty()
  channel: string;

  @ApiProperty()
  payload: UserPayload;
}

export class ForgotPasswordResponse {
  @ApiProperty()
  refCode: string;

  @ApiProperty()
  expiresTime: string;
}

export class ForgotPasswordVerificationOtpDto extends ForgotPasswordRequestOtpDto {
  @ApiProperty()
  refCode: string;

  @ApiProperty()
  otp: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  refCode: string;

  @ApiProperty()
  newPassword: string;
}

export class RequestOtpDto extends ForgotPasswordRequestOtpDto {
  @ApiProperty()
  objective: string;
}

export class RequestOtpResponse extends ForgotPasswordResponse {
  @ApiProperty()
  objective: string;
}

export class VerificationOtpDto extends ForgotPasswordVerificationOtpDto {
  @ApiProperty()
  objective: string;
}
