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
import { CacheKeyName, Environment } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  BearerToken,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleController,
  RequestMeta,
  RequestMetadata,
} from '@castcle-api/utils/decorators';
import { HeadersInterceptor } from '@castcle-api/utils/interceptors';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Response,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import {
  CheckEmailExistDto,
  CheckIdExistDto,
  CheckingResponseV2,
  GuestLoginDto,
  OtpResponse,
} from './app.dto';
import { getEmailVerificationHtml } from './app.html-template';
import { ConnectWithSocialService } from './services/connect-with-social/service.abstract';
import { GuestLoginService } from './services/guest-login/service.abstract';
import { LoginWithEmailService } from './services/login-with-email/service.abstract';
import { LoginWithSocialService } from './services/login-with-social/service.abstract';
import { RefreshTokenService } from './services/refresh-token/service.abstract';
import { RegisterWithEmailService } from './services/register-with-email/service.abstract';

@CastcleController({ path: 'v2/authentications' })
export class AuthenticationControllerV2 {
  constructor(
    private authenticationService: AuthenticationServiceV2,
    private connectWithSocialService: ConnectWithSocialService,
    private guestLoginService: GuestLoginService,
    private loginWithEmailService: LoginWithEmailService,
    private loginWithSocialService: LoginWithSocialService,
    private refreshTokenService: RefreshTokenService,
    private registerWithEmailService: RegisterWithEmailService,
  ) {}

  @Post('guest')
  guestLogin(
    @Body() { deviceUUID }: GuestLoginDto,
    @RequestMeta() { device, ip, language, platform }: RequestMetadata,
  ) {
    return this.guestLoginService.execute({
      device,
      deviceUUID,
      ip,
      preferLanguages: [language],
      platform,
    });
  }

  @Post('refresh-token')
  async refreshToken(
    @BearerToken() refreshToken: string,
    @RequestMeta() { ip }: RequestMetadata,
  ) {
    return this.refreshTokenService.execute({ refreshToken, ip });
  }

  @Post('register-with-email')
  async requestEmailOtp(
    @BearerToken() guestAccessToken: string,
    @Body() dto: RegisterWithEmailDto,
    @RequestMeta() { ip, hostUrl }: RequestMetadata,
  ) {
    return this.registerWithEmailService.execute({
      ...dto,
      guestAccessToken,
      hostUrl,
      ip,
    });
  }

  @Post('login-with-email')
  loginWithEmail(
    @BearerToken() guestAccessToken: string,
    @Body() { email, password }: LoginWithEmailDto,
    @RequestMeta() { ip }: RequestMetadata,
  ) {
    return this.loginWithEmailService.execute({
      email,
      password,
      guestAccessToken,
      ip,
    });
  }

  @Post('login-with-social')
  loginWithSocial(
    @BearerToken() guestAccessToken: string,
    @Body() socialConnectDto: SocialConnectDto,
    @RequestMeta() { hostUrl, ip, userAgent }: RequestMetadata,
  ) {
    return this.loginWithSocialService.execute({
      ...socialConnectDto,
      guestAccessToken,
      hostUrl,
      ip,
      userAgent,
    });
  }

  @Post('connect-with-social')
  @CastcleBasicAuth()
  connectWithSocial(
    @Auth() { account }: Authorizer,
    @BearerToken() guestAccessToken: string,
    @Body() socialConnectDto: SocialConnectDto,
  ) {
    return this.connectWithSocialService.execute({
      ...socialConnectDto,
      account,
      accessToken: guestAccessToken,
    });
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
    @Auth() { account }: Authorizer,
    @Body() requestOtpDto: RequestOtpByEmailDto,
    @RequestMeta() requestMetadata: RequestMetadata,
  ) {
    const { refCode, expireDate } =
      await this.authenticationService.requestOtpByEmail({
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
    Environment.RATE_LIMIT_OTP_MOBILE_LIMIT,
    Environment.RATE_LIMIT_OTP_MOBILE_TTL,
  )
  @Post('request-otp/mobile')
  async requestOtpByMobile(
    @Auth() { account }: Authorizer,
    @Body() requestOtpDto: RequestOtpByMobileDto,
    @RequestMeta() requestMetadata: RequestMetadata,
  ) {
    const { refCode, expireDate } =
      await this.authenticationService.requestOtpByMobile({
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
    @Auth() { account }: Authorizer,
    @BearerToken() guestAccessToken: string,
    @Body() verifyOtpDto: VerifyOtpByEmailDto,
  ) {
    const { otp, accessToken } =
      await this.authenticationService.verifyOtpByEmail({
        ...verifyOtpDto,
        requestedBy: account,
        guestAccessToken,
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
    @Auth() { account }: Authorizer,
    @Body() verifyOtpDto: VerifyOtpByMobileDto,
  ) {
    const otp = await this.authenticationService.verifyOtpByMobile({
      ...verifyOtpDto,
      requestedBy: account,
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
    @Auth() { account }: Authorizer,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authenticationService.changePassword({
      ...changePasswordDto,
      requestedBy: account,
    });
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

  @CastcleClearCacheAuth(CacheKeyName.Users)
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
