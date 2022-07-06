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
  AnalyticService,
  AuthenticationService,
  SocialConnectDto,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { TwilioChannel } from '@castcle-api/utils/clients';
import {
  CastcleBasicAuth,
  CastcleController,
  CastcleTrack,
  RequestMeta,
  RequestMetadata,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import {
  CredentialInterceptor,
  CredentialRequest,
  HeadersRequest,
  TokenInterceptor,
  TokenRequest,
} from '@castcle-api/utils/interceptors';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  Response,
  UseInterceptors,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { AppService } from '../app.service';
import { getEmailVerificationHtml } from '../configs';
import {
  ChangePasswordBody,
  CheckEmailExistDto,
  CheckIdExistDto,
  CheckingResponse,
  GuestLoginDto,
  LoginDto,
  LoginResponse,
  OtpResponse,
  RefreshTokenResponse,
  RegisterByEmailDto,
  RequestOtpDto,
  RequestTokenDeviceDto,
  SuggestCastcleIdDto,
  SuggestCastcleIdResponse,
  TokenResponse,
  VerificationOtpDto,
  VerificationPasswordBody,
} from '../dtos';
import {
  GuestInterceptor,
  GuestRequest,
} from '../interceptors/guest.interceptor';

@CastcleController({ path: 'authentications', version: '1.0' })
export class AuthenticationController {
  constructor(
    private analyticService: AnalyticService,
    private appService: AppService,
    private authService: AuthenticationService,
  ) {}

  private logger = new CastLogger(AuthenticationController.name);

  @ApiResponse({
    status: 400,
    description: 'will show if some of header is missing',
  })
  @ApiOkResponse({
    status: 201,
    type: CheckingResponse,
  })
  @ApiBody({
    type: CheckEmailExistDto,
  })
  @Post('checkEmailExists')
  @HttpCode(200)
  async checkEmailExists(
    @Req() req: HeadersRequest,
    @Body() { email }: CheckEmailExistDto,
  ) {
    if (!this.authService.validateEmail(email))
      throw new CastcleException('INVALID_EMAIL');
    try {
      const account = await this.authService.getAccountFromEmail(email);
      return {
        message: 'success message',
        payload: {
          exist: account ? true : false,
        },
      };
    } catch (error) {
      throw new CastcleException('INVALID_EMAIL');
    }
  }

  @ApiBearerAuth()
  @ApiBody({
    type: LoginDto,
  })
  @ApiOkResponse({
    status: 200,
    type: LoginResponse,
  })
  @UseInterceptors(CredentialInterceptor)
  @CastcleTrack()
  @Post('login')
  @HttpCode(200)
  async login(
    @Req() req: CredentialRequest,
    @Body() { username, password }: LoginDto,
  ) {
    try {
      const account = await this.authService.getAccountFromEmail(username);
      if (!account) throw new CastcleException('INVALID_EMAIL');
      if (await account.verifyPassword(password)) {
        const embedCredentialByDeviceUUID = account.credentials.find(
          (item) => item.deviceUUID === req.$credential.deviceUUID,
        );
        if (embedCredentialByDeviceUUID) {
          req.$credential = await this.authService._credentialModel
            .findById(embedCredentialByDeviceUUID._id)
            .exec();
          req.$credential.account.geolocation = req['$geolocation'];
          req.$credential.markModified('account');
          req.$credential.save();
        } else {
          account.geolocation = req['$geolocation'];
          req.$credential = await this.authService.linkCredentialToAccount(
            req.$credential,
            account,
          );
        }
        console.debug('afterCredential', req.$credential);
        const userProfile = await this.appService.getUserProfile(
          req.$credential,
        );

        const accessTokenPayload =
          await this.authService.getAccessTokenPayloadFromCredential(
            req.$credential,
          );
        console.debug('accessTokenPayload', accessTokenPayload);
        const tokenResult: TokenResponse = await req.$credential.renewTokens(
          accessTokenPayload,
          {
            id: account._id as unknown as string,
          },
        );
        const result = new LoginResponse();
        result.accessToken = tokenResult.accessToken;
        result.refreshToken = tokenResult.refreshToken;
        result.profile = userProfile.profile
          ? await userProfile.profile.toUserResponse({ mobile: account.mobile })
          : null;
        result.pages = userProfile.pages
          ? userProfile.pages.items.map((item) => item.toPageResponse())
          : null;

        return result;
      } else throw new CastcleException('INVALID_EMAIL_OR_PASSWORD');
    } catch (error) {
      this.logger.error('Login error', error.stack);
      throw new CastcleException('INVALID_EMAIL_OR_PASSWORD');
    }
  }

  @ApiHeader({
    name: 'Device',
    description: 'Device name',
    example: 'iPhone',
    required: true,
  })
  @ApiHeader({
    name: 'Platform',
    description: 'platform',
    example: 'android',
    required: true,
  })
  @ApiOkResponse({
    type: TokenResponse,
  })
  @ApiBody({
    type: GuestLoginDto,
  })
  @ApiResponse({
    status: 400,
    description: 'will show if some of header is missing',
  })
  @CastcleTrack()
  @UseInterceptors(GuestInterceptor)
  @Post('guestLogin')
  async guestLogin(@Req() req: GuestRequest, @Body() body: GuestLoginDto) {
    const deviceUUID = body.deviceUUID;
    const credential = await this.authService.getGuestCredentialFromDeviceUUID(
      deviceUUID,
    );

    if (credential) {
      const tokenResult: TokenResponse = await credential.renewTokens(
        {
          id: credential.account._id as unknown as string,
          role: 'guest',
          showAds: true,
        },
        {
          id: credential.account._id as unknown as string,
        },
      );
      //update geolocation if current geolocation is not the same from service
      return tokenResult;
    } else {
      const result = await this.authService.createAccount({
        device: req.$device,
        deviceUUID: deviceUUID,
        header: { platform: req.$platform },
        languagesPreferences: [req.$language],
        geolocation: req.$geolocation,
      });
      return {
        accessToken: result.credentialDocument.accessToken,
        refreshToken: result.credentialDocument.refreshToken,
      } as TokenResponse;
    }
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    type: LoginResponse,
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('register')
  async register(
    @Req() req: CredentialRequest,
    @Body() body: RegisterByEmailDto,
    @RequestMeta() { hostUrl, ip }: RequestMetadata,
  ) {
    if (body.channel === 'email') {
      //check if this account already sign up
      const currentAccount = await this.authService.getAccountFromCredential(
        req.$credential,
      );
      if (!currentAccount?.isGuest)
        throw new CastcleException('INVALID_ACCESS_TOKEN');
      if (currentAccount?.email === body.payload.email)
        throw new CastcleException('EMAIL_OR_PHONE_IS_EXIST');
      //check if account already activate
      //check if email exist and not the same
      if (await this.authService.getAccountFromEmail(body.payload.email))
        throw new CastcleException('EMAIL_OR_PHONE_IS_EXIST');
      if (!this.authService.validateEmail(body.payload.email))
        throw new CastcleException('INVALID_EMAIL');
      //check if castcleId Exist
      const user = await this.authService.getExistedUserFromCastcleId(
        body.payload.castcleId,
      );
      //validate password
      this.appService.validatePassword(body.payload.password);

      if (user) throw new CastcleException('USER_ID_IS_EXIST');

      const accountActivation = await this.authService.signupByEmail(
        currentAccount,
        {
          displayId: body.payload.castcleId,
          displayName: body.payload.displayName,
          email: body.payload.email,
          password: body.payload.password,
          referral: body.referral,
          ip,
        },
      );
      await this.analyticService.trackRegistration(ip, currentAccount._id);
      //check if display id exist
      //send an email
      console.log('send email with token => ', accountActivation.verifyToken);
      await this.appService.sendRegistrationEmail(
        hostUrl,
        body.payload.email,
        accountActivation.verifyToken,
      );
      //TODO !!! Need to improve this performance
      //make new token isGuest = false
      req.$credential.account.isGuest = false;
      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(
          req.$credential,
        );

      const userProfile = await this.appService.getUserProfile(req.$credential);
      const tokenResult = await req.$credential.renewTokens(
        accessTokenPayload,
        { id: currentAccount._id as unknown as string },
      );

      const result = new LoginResponse();
      result.accessToken = tokenResult.accessToken;
      result.refreshToken = tokenResult.refreshToken;
      result.profile = userProfile.profile
        ? await userProfile.profile.toUserResponse()
        : null;
      result.pages = userProfile.pages
        ? userProfile.pages.items.map((item) => item.toPageResponse())
        : null;
      return result;
    }
    throw new CastcleException('PAYLOAD_CHANNEL_MISMATCH');
  }

  @ApiResponse({
    status: 201,
    type: RefreshTokenResponse,
  })
  @ApiResponse({
    status: 400,
    description:
      'will show if some of header is missing or invalid refresh token',
  })
  @ApiBearerAuth()
  @UseInterceptors(TokenInterceptor)
  @Post('refreshToken')
  async refreshToken(@Req() req: TokenRequest) {
    /*
     * TODO: !!!
     * should embed  account and user for better performance
     */
    const credential = await this.authService.getCredentialFromRefreshToken(
      req.$token,
    );
    if (credential && credential.isRefreshTokenValid()) {
      const userProfile = await this.appService.getUserProfile(credential);
      this.logger.log('Validate profile member.');
      if (!userProfile.profile && !credential.account.isGuest) {
        this.logger.warn('Member Profile is empty.');
        throw new CastcleException('INVALID_REFRESH_TOKEN');
      }

      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(credential);

      const newAccessToken = await credential.renewAccessToken(
        accessTokenPayload,
      );

      const account = await this.authService.getAccountFromId(
        credential.account._id,
      );
      return {
        profile: userProfile.profile
          ? await userProfile.profile.toUserResponse({
              passwordNotSet: account.password ? false : true,
              mobile: account.mobile,
            })
          : null,
        pages: userProfile.pages
          ? userProfile.pages.items.map((item) => item.toPageResponse())
          : null,
        accessToken: newAccessToken,
      } as RefreshTokenResponse;
    }
    throw new CastcleException('INVALID_REFRESH_TOKEN');
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 204,
  })
  @ApiResponse({
    status: 403,
    description: 'will reject if token is invalid',
  })
  @Post('verificationEmail')
  @HttpCode(204)
  @UseInterceptors(TokenInterceptor)
  async verificationEmail(@Req() req: TokenRequest) {
    const accountActivation =
      await this.authService.getAccountActivationFromVerifyToken(req.$token);
    if (accountActivation && accountActivation.isVerifyTokenValid()) {
      //verify email
      const account = await this.authService.verifyAccount(accountActivation);
      if (!account) throw new CastcleException('INVALID_REFRESH_TOKEN');
      return '';
    }
    throw new CastcleException('INVALID_REFRESH_TOKEN');
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 204,
  })
  @ApiResponse({
    status: 403,
    description: 'will reject if token is invalid',
  })
  @Post('requestLinkVerify')
  @UseInterceptors(CredentialInterceptor)
  async requestLinkVerify(
    @Req() req: CredentialRequest,
    @Res() response: FastifyReply,
    @RequestMeta() { hostUrl }: RequestMetadata,
  ) {
    const accountActivation =
      await this.authService.getAccountActivationFromCredential(
        req.$credential,
      );
    if (!accountActivation) throw new CastcleException('INVALID_REFRESH_TOKEN');
    const newAccountActivation = await this.authService.revokeAccountActivation(
      accountActivation,
    );
    if (!accountActivation) throw new CastcleException('INVALID_REFRESH_TOKEN');
    if (accountActivation.activationDate) {
      const returnObj = {
        message: 'This email has been verified.',
      };
      response.status(200).send(returnObj);
      return returnObj;
    }
    const account = await this.authService.getAccountFromCredential(
      req.$credential,
    );
    if (!(account && account.email))
      throw new CastcleException('INVALID_EMAIL');
    this.appService.sendRegistrationEmail(
      hostUrl,
      account.email,
      newAccountActivation.verifyToken,
    );
    response.status(204).send();
    return '';
  }

  @ApiOkResponse({
    type: CheckingResponse,
  })
  @Post('checkCastcleIdExists')
  @HttpCode(200)
  async checkCastcleIdExists(@Body() body: CheckIdExistDto) {
    const user = await this.authService.getExistedUserFromCastcleId(
      body.castcleId,
    );
    return {
      message: 'success message',
      payload: {
        exist: user ? true : false, // true=มีในระบบ, false=ไม่มีในระบบ
      },
    } as CheckingResponse;
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    type: OtpResponse,
  })
  @CastcleBasicAuth()
  @Throttle(Environment.RATE_LIMIT_OTP_LIMIT, Environment.RATE_LIMIT_OTP_TTL) //limit 1 ttl 60 secs
  @Post('verificationOTP')
  @HttpCode(200)
  async verificationOTP(
    @Body() body: VerificationOtpDto,
    @Req() req: CredentialRequest,
  ) {
    this.logger.log(
      `Start verify OPT channel: ${body.channel} objective: ${body.objective} refCode: ${body.refCode}`,
    );
    const { otp, token } = await this.appService.verificationOTP(body, req);
    if (otp && otp.isValid()) {
      const response: OtpResponse = {
        objective: body.objective,
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString(),
        accessToken: token?.accessToken,
      };
      return response;
    } else {
      throw new CastcleException('EXPIRED_OTP');
    }
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    type: OtpResponse,
  })
  @CastcleBasicAuth()
  @Throttle(Environment.RATE_LIMIT_OTP_LIMIT, Environment.RATE_LIMIT_OTP_TTL) //limit 1 ttl 60 se
  @Post('requestOTP')
  @HttpCode(200)
  async requestOTP(
    @Body() body: RequestOtpDto,
    @Req() req: CredentialRequest,
    @RequestMeta() { ip, userAgent, source }: RequestMetadata,
  ) {
    this.logger.log(
      `Start request OPT channel: ${body.channel} objective: ${body.objective}`,
    );
    const otp = await this.appService.requestOtpCode(
      body,
      req,
      ip,
      userAgent,
      source,
    );
    if (otp && otp.isValid()) {
      const response: OtpResponse = {
        objective: body.objective,
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString(),
      };
      return response;
    } else {
      throw new CastcleException('EXPIRED_OTP');
    }
  }
  /*
   * TODO: !!! use for test link verification only will remove in production
   */
  @Version(VERSION_NEUTRAL)
  @Get('verify')
  async verify(
    @Query('code') $token: string,
    @Req() { $language }: CredentialRequest,
    @Response() res: FastifyReply,
  ) {
    if (!$token) {
      throw new CastcleException('REQUEST_URL_NOT_FOUND');
    }

    await this.verificationEmail({
      $language,
      $token,
    } as TokenRequest);
    const email = await this.authService.getEmailFromVerifyToken($token);

    return res.type('text/html').send(getEmailVerificationHtml(email));
  }

  @ApiOkResponse({ type: SuggestCastcleIdResponse })
  @Post('suggestCastcleId')
  @HttpCode(200)
  async suggestCastcleId(
    @Body() { displayName }: SuggestCastcleIdDto,
  ): Promise<SuggestCastcleIdResponse> {
    const suggestId = await this.authService.suggestCastcleId(displayName);
    return {
      payload: {
        suggestCastcleId: suggestId,
      },
    };
  }

  @ApiBody({
    type: VerificationPasswordBody,
  })
  @ApiResponse({
    status: 201,
    type: OtpResponse,
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('verificationPassword')
  async verificationPassword(
    @Body() payload: VerificationPasswordBody,
    @Req() req: CredentialRequest,
  ): Promise<OtpResponse> {
    const account = await this.authService.getAccountFromCredential(
      req.$credential,
    );
    //add password checker
    this.appService.validatePassword(payload.password);
    if (account.verifyPassword(payload.password)) {
      const otp = await this.authService.generateOtp(
        account,
        payload.objective,
        req.$credential.account._id,
        TwilioChannel.EMAIL,
        true,
      );
      return {
        objective: payload.objective,
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString(),
      };
    } else throw new CastcleException('INVALID_PASSWORD');
  }

  @CastcleBasicAuth()
  @ApiBody({
    type: ChangePasswordBody,
  })
  @ApiResponse({
    status: 204,
  })
  @Post('changePasswordSubmit')
  @HttpCode(204)
  async changePasswordSubmit(
    @Body() payload: ChangePasswordBody,
    @Req() req: CredentialRequest,
  ) {
    this.logger.log(`Start change password refCode: ${payload.refCode}`);
    return this.appService.resetPassword(payload, req);
  }

  @CastcleBasicAuth()
  @ApiBody(
    /* Creating a type alias for a function that takes a string and returns a string. */
    {
      type: SocialConnectDto,
    },
  )
  @ApiOkResponse({
    status: 200,
    type: LoginResponse,
  })
  @UseInterceptors(CredentialInterceptor)
  @CastcleTrack()
  @Post('login-with-social')
  async loginWithSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialConnectDto,
    @RequestMeta() { ip, userAgent }: RequestMetadata,
  ) {
    this.logger.log(`login with social: ${body.provider}`);
    this.logger.log(`payload: ${JSON.stringify(body)}`);

    const { token, users, account, isNewUser } =
      await this.appService.socialLogin(body, req, { ip });

    if (isNewUser) {
      await this.analyticService.trackRegistration(ip, userAgent);
    }

    if (!token) {
      this.logger.log(`response merge account.`);
      throw new CastcleException('DUPLICATE_EMAIL', {
        profile: users.profile
          ? await users.profile.toUserResponse({
              passwordNotSet: account.password ? false : true,
            })
          : null,
      });
    }

    this.logger.log(`response success.`);
    return {
      profile: users.profile
        ? await users.profile.toUserResponse({
            passwordNotSet: account.password ? false : true,
          })
        : null,
      pages: users.pages
        ? users.pages.items.map((item) => item.toPageResponse())
        : null,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
    } as LoginResponse;
  }

  @CastcleBasicAuth()
  @ApiBody({
    type: SocialConnectDto,
  })
  @ApiOkResponse({
    status: 200,
    type: LoginResponse,
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('connect-with-social')
  async connectWithSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialConnectDto,
  ) {
    this.logger.log(`connect with social: ${body.provider}`);
    this.logger.log(`payload: ${JSON.stringify(body)}`);

    const currentAccount = await this.authService.getAccountFromCredential(
      req.$credential,
    );
    if (currentAccount?.isGuest) throw new CastcleException('FORBIDDEN');

    const socialAccount = await this.authService.getAccountAuthenIdFromSocialId(
      body.socialId,
      body.provider,
    );
    if (socialAccount) {
      this.logger.error(`already connect social: ${body.provider}.`);
      throw new CastcleException('SOCIAL_PROVIDER_IS_EXIST');
    }

    this.logger.log(`connect account with social`);
    await this.authService.createAccountAuthenId(
      currentAccount,
      body.provider,
      body.socialId,
      body.authToken ? body.authToken : undefined,
      undefined,
      body.avatar ? body.avatar : undefined,
      body.displayName ? body.displayName : undefined,
    );

    await this.authService.embedAuthentication(currentAccount, {
      provider: body.provider,
      socialId: body.socialId,
      avatar: body.avatar ? body.avatar : undefined,
      socialToken: body.authToken ? body.authToken : undefined,
    });

    const { token, users, account } = await this.appService.socialLogin(
      body,
      req,
    );

    this.logger.log(`response success.`);
    return {
      profile: users.profile
        ? await users.profile.toUserResponse({
            passwordNotSet: account.password ? false : true,
          })
        : null,
      pages: users.pages
        ? users.pages.items.map((item) => item.toPageResponse())
        : null,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
    } as LoginResponse;
  }

  @UseInterceptors(CredentialInterceptor)
  @Post('register-token')
  @HttpCode(200)
  async registerToken(
    @Req() { $credential }: CredentialRequest,
    @Body() body: RequestTokenDeviceDto,
  ) {
    await this.authService.createAccountDevice({
      accountId: $credential.account._id,
      ...body,
    });
  }

  @UseInterceptors(CredentialInterceptor)
  @Delete('register-token')
  @HttpCode(200)
  async unregisterToken(
    @Req() { $credential }: CredentialRequest,
    @Body() body: RequestTokenDeviceDto,
  ) {
    await this.authService.deleteAccountDevice({
      accountId: $credential.account._id,
      ...body,
    });
  }
}
