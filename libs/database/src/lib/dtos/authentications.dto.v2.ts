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
import {
  IsEmail,
  IsEnum,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { OtpObjective } from '../models';

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
  @IsEnum([OtpObjective.ForgotPassword, OtpObjective.MergeAccount])
  objective: OtpObjective;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  recaptchaToken?: string;
}

export class RequestOtpByMobileDto {
  @IsEnum([OtpObjective.VerifyMobile])
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
  @IsEnum([OtpObjective.ForgotPassword, OtpObjective.MergeAccount])
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
  @IsEnum([OtpObjective.VerifyMobile])
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
  @IsEnum([OtpObjective.ChangePassword, OtpObjective.ForgotPassword])
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
