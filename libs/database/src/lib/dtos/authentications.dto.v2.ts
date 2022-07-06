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

import { CastcleRegExp, RemoveLeadingZero } from '@castcle-api/utils/commons';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { AuthenticationProvider, OtpObjective } from '../models';
import { AcceptPlatform } from './common.dto';

export class LoginWithEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterWithEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(CastcleRegExp.PASSWORD_PATTERN)
  password: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsNotEmpty()
  castcleId: string;

  @IsOptional()
  @IsString()
  referral?: string;
}

export class RequestOtpByEmailDto {
  @IsEnum([
    OtpObjective.CHANGE_PASSWORD,
    OtpObjective.FORGOT_PASSWORD,
    OtpObjective.MERGE_ACCOUNT,
    OtpObjective.SEND_TOKEN,
  ])
  objective: OtpObjective;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  recaptchaToken?: string;
}

export class RequestOtpForChangingPasswordDto {
  @IsEnum([OtpObjective.CHANGE_PASSWORD])
  objective: OtpObjective;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(CastcleRegExp.PASSWORD_PATTERN)
  password: string;
}

export class RequestOtpByMobileDto {
  @IsEnum([OtpObjective.VERIFY_MOBILE, OtpObjective.SEND_TOKEN])
  objective: OtpObjective;

  @IsMobilePhone()
  @RemoveLeadingZero()
  mobileNumber: string;

  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  recaptchaToken?: string;
}

export class VerifyOtpByEmailDto {
  @IsEnum([
    OtpObjective.CHANGE_PASSWORD,
    OtpObjective.FORGOT_PASSWORD,
    OtpObjective.MERGE_ACCOUNT,
  ])
  objective: OtpObjective;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  refCode: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class VerifyOtpByMobileDto {
  @IsEnum([OtpObjective.VERIFY_MOBILE])
  objective: OtpObjective;

  @IsMobilePhone()
  @RemoveLeadingZero()
  mobileNumber: string;

  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @IsString()
  @IsNotEmpty()
  refCode: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class ChangePasswordDto {
  @IsEnum([OtpObjective.CHANGE_PASSWORD, OtpObjective.FORGOT_PASSWORD])
  objective: OtpObjective;

  @IsString()
  @IsNotEmpty()
  refCode: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(CastcleRegExp.PASSWORD_PATTERN)
  newPassword: string;
}

export class RegisterFirebaseDto {
  @IsString()
  @IsNotEmpty()
  firebaseToken: string;

  @IsString()
  @IsNotEmpty()
  uuid: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(AcceptPlatform)
  platform: AcceptPlatform;
}

export class SocialConnectDto {
  @Transform(({ obj }) =>
    /apple/.test(obj.provider) ? AuthenticationProvider.APPLE : obj.provider,
  )
  @IsEnum(AuthenticationProvider)
  provider: AuthenticationProvider;

  @IsString()
  socialId: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsNotEmpty()
  @IsString()
  authToken: string;

  @IsString()
  @IsOptional()
  referral?: string;

  @IsString()
  @IsOptional()
  overview?: string;

  @IsString()
  @IsOptional()
  cover?: string;

  @IsString()
  @IsOptional()
  link?: string;
}

export class GetDisplayNameDto {
  @IsString()
  displayName: string;
}
