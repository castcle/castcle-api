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
  AccountRequirements,
  AuthenticationServiceV2,
  ChangePasswordDto,
  GetDisplayNameDto,
  LoginWithEmailDto,
  RegisterFirebaseDto,
  RegisterWithEmailDto,
  RequestOtpByEmailDto,
  RequestOtpByMobileDto,
  RequestOtpForChangingPasswordDto,
  ResponseDto,
  SocialConnectDto,
  VerifyOtpByEmailDto,
  VerifyOtpByMobileDto,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  CastcleBasicAuth,
  CastcleControllerV2,
  CastcleTrack,
  RequestMeta,
  RequestMetadata,
} from '@castcle-api/utils/decorators';
import {
  CredentialRequest,
  HeadersInterceptor,
  TokenInterceptor,
  TokenRequest,
} from '@castcle-api/utils/interceptors';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Response,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { getEmailVerificationHtml } from '../configs';
import {
  CheckEmailExistDto,
  CheckIdExistDto,
  CheckingResponseV2,
  GuestLoginDto,
  OtpResponse,
} from '../dtos';
import {
  GuestInterceptor,
  GuestRequest,
} from '../interceptors/guest.interceptor';

@CastcleControllerV2({ path: 'authentications' })
export class AuthenticationControllerV2 {
  constructor(private authenticationService: AuthenticationServiceV2) {}

  @CastcleBasicAuth()
  @Post('register-with-email')
  async requestEmailOtp(
    @Body() dto: RegisterWithEmailDto,
    @RequestMeta() { ip, hostUrl }: RequestMetadata,
    @Req() { $credential }: CredentialRequest,
  ) {
    return this.authenticationService.registerWithEmail($credential, {
      ...dto,
      hostUrl,
      ip,
    });
  }

  @Post('login-with-email')
  @CastcleBasicAuth()
  @CastcleTrack()
  loginWithEmail(
    @Body() { email, password }: LoginWithEmailDto,
    @Req() { $credential }: CredentialRequest,
  ) {
    return this.authenticationService.loginWithEmail(
      $credential,
      email,
      password,
    );
  }

  @Post('login-with-social')
  @CastcleBasicAuth()
  @CastcleTrack()
  loginWithSocial(
    @Body() socialConnectDto: SocialConnectDto,
    @Req() { $credential }: CredentialRequest,
    @RequestMeta() { ip, userAgent }: RequestMetadata,
  ) {
    return this.authenticationService.loginWithSocial($credential, {
      ...socialConnectDto,
      ip,
      userAgent,
    });
  }

  @Post('connect-with-social')
  @CastcleBasicAuth()
  @CastcleTrack()
  connectWithSocial(
    @Auth() { account }: Authorizer,
    @Body() socialConnectDto: SocialConnectDto,
    @Req() { $credential }: CredentialRequest,
  ) {
    return this.authenticationService.connectWithSocial(
      $credential,
      account,
      socialConnectDto,
    );
  }

  @UseInterceptors(TokenInterceptor)
  @Post('refresh-token')
  async refreshToken(@Req() req: TokenRequest) {
    return this.authenticationService.getRefreshToken(req.$token);
  }

  @UseInterceptors(HeadersInterceptor)
  @Post('exists/castcle-id')
  @HttpCode(200)
  async checkCastcleIdExists(@Body() body: CheckIdExistDto) {
    const user = await this.authenticationService.getExistedUserFromCastcleId(
      body.castcleId,
    );
    return ResponseDto.ok<CheckingResponseV2>({
      payload: {
        exist: user ? true : false,
      },
    });
  }

  @UseInterceptors(HeadersInterceptor)
  @Post('exists/email')
  @HttpCode(200)
  async checkEmailExists(@Body() { email }: CheckEmailExistDto) {
    const account = await this.authenticationService.getAccountFromEmail(email);
    return ResponseDto.ok<CheckingResponseV2>({
      payload: {
        exist: account ? true : false,
      },
    });
  }

  @CastcleBasicAuth()
  @Throttle(
    Environment.RATE_LIMIT_OTP_EMAIL_LIMIT,
    Environment.RATE_LIMIT_OTP_EMAIL_TTL,
  )
  @Post('request-otp/email')
  async requestOtpByEmail(
    @Body() requestOtpDto: RequestOtpByEmailDto,
    @Req() { $credential }: CredentialRequest,
    @RequestMeta() requestMetadata: RequestMetadata,
  ) {
    const { refCode, expireDate } =
      await this.authenticationService.requestOtpByEmail({
        ...requestOtpDto,
        ...requestMetadata,
        requestedBy: $credential.account,
      });

    return {
      refCode,
      objective: requestOtpDto.objective,
      expiresTime: expireDate.toISOString(),
    } as OtpResponse;
  }

  @CastcleBasicAuth()
  @Throttle(
    Environment.RATE_LIMIT_OTP_MOBILE_LIMIT,
    Environment.RATE_LIMIT_OTP_MOBILE_TTL,
  )
  @Post('request-otp/mobile')
  async requestOtpByMobile(
    @Body() requestOtpDto: RequestOtpByMobileDto,
    @Req() { $credential }: CredentialRequest,
    @RequestMeta() requestMetadata: RequestMetadata,
  ) {
    const { refCode, expireDate } =
      await this.authenticationService.requestOtpByMobile({
        ...requestOtpDto,
        ...requestMetadata,
        requestedBy: $credential.account,
      });

    return {
      refCode,
      objective: requestOtpDto.objective,
      expiresTime: expireDate.toISOString(),
    } as OtpResponse;
  }

  @CastcleBasicAuth()
  @Throttle(
    Environment.RATE_LIMIT_OTP_EMAIL_LIMIT,
    Environment.RATE_LIMIT_OTP_EMAIL_TTL,
  )
  @Post('verify-password')
  async requestOtpForChangingPassword(
    @Auth() { account }: Authorizer,
    @Body() requestOtpDto: RequestOtpForChangingPasswordDto,
    @RequestMeta() requestMetadata: RequestMetadata,
  ) {
    const { refCode, expireDate } =
      await this.authenticationService.requestOtpForChangingPassword({
        ...requestOtpDto,
        ...requestMetadata,
        requestedBy: account,
      });

    return {
      refCode,
      objective: requestOtpDto.objective,
      expiresTime: expireDate.toISOString(),
    } as OtpResponse;
  }

  @CastcleBasicAuth()
  @Throttle(
    Environment.RATE_LIMIT_OTP_EMAIL_LIMIT,
    Environment.RATE_LIMIT_OTP_EMAIL_TTL,
  )
  @Post('verify-otp/email')
  async verifyOtpByEmail(
    @Body() verifyOtpDto: VerifyOtpByEmailDto,
    @Req() { $credential }: CredentialRequest,
  ) {
    const { otp, accessToken } =
      await this.authenticationService.verifyOtpByEmail({
        ...verifyOtpDto,
        credential: $credential,
      });

    return {
      refCode: otp.refCode,
      objective: verifyOtpDto.objective,
      expiresTime: otp.expireDate.toISOString(),
      accessToken,
    } as OtpResponse;
  }

  @CastcleBasicAuth()
  @Throttle(
    Environment.RATE_LIMIT_OTP_MOBILE_LIMIT,
    Environment.RATE_LIMIT_OTP_MOBILE_TTL,
  )
  @Post('verify-otp/mobile')
  async verifyOtpByMobile(
    @Body() verifyOtpDto: VerifyOtpByMobileDto,
    @Req() { $credential }: CredentialRequest,
  ) {
    const otp = await this.authenticationService.verifyOtpByMobile({
      ...verifyOtpDto,
      requestedBy: $credential.account,
    });

    return {
      refCode: otp.refCode,
      objective: verifyOtpDto.objective,
      expiresTime: otp.expireDate.toISOString(),
    } as OtpResponse;
  }

  @Throttle(
    Environment.RATE_LIMIT_OTP_EMAIL_LIMIT,
    Environment.RATE_LIMIT_OTP_EMAIL_TTL,
  )
  @CastcleBasicAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() { $credential }: CredentialRequest,
  ) {
    return this.authenticationService.changePassword({
      ...changePasswordDto,
      requestedBy: $credential.account,
    });
  }

  @CastcleTrack()
  @UseInterceptors(GuestInterceptor)
  @Post('guest')
  async guestLogin(
    @Req() req: GuestRequest,
    @Body() { deviceUUID }: GuestLoginDto,
  ) {
    const requestOption: AccountRequirements = {
      deviceUUID,
      device: req.$device,
      header: {
        platform: req.$platform,
      },
      languagesPreferences: [req.$language],
      geolocation: req.$geolocation || null,
    };

    return await this.authenticationService.guestLogin(requestOption);
  }

  @CastcleBasicAuth()
  @Post('request-link/email')
  @HttpCode(HttpStatus.NO_CONTENT)
  requestVerificationLink(
    @Auth() { account }: Authorizer,
    @RequestMeta() { hostUrl }: RequestMetadata,
  ) {
    return this.authenticationService.requestVerificationLink(account, hostUrl);
  }

  @Get('verify/email')
  async verifyEmail(
    @Query() { code }: Record<string, string>,
    @Response() res: FastifyReply,
  ) {
    const [account] = await this.authenticationService.verifyEmail(code);

    return res.type('text/html').send(getEmailVerificationHtml(account.email));
  }

  @CastcleBasicAuth()
  @Post('register/notification')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerToken(
    @Auth() { account }: Authorizer,
    @Body() body: RegisterFirebaseDto,
  ) {
    await this.authenticationService.createAccountDevice(body, account);
  }

  @CastcleBasicAuth()
  @Delete('register/notification')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteToken(
    @Auth() { account }: Authorizer,
    @Body() body: RegisterFirebaseDto,
  ) {
    await this.authenticationService.deleteAccountDevice(body, account);
  }

  @Post('suggest/castcle-id')
  @HttpCode(200)
  async suggestCastcleId(@Body() { displayName }: GetDisplayNameDto) {
    const suggestCastcleId = await this.authenticationService.suggestCastcleId(
      displayName,
    );

    return { suggestCastcleId };
  }
}
