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
import { AuthenticationService } from '@castcle-api/database';
import { OtpObjective } from '@castcle-api/database/schemas';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { Host } from '@castcle-api/utils/commons';
import {
  CastcleBasicAuth,
  CastcleController,
  CastcleTrack,
} from '@castcle-api/utils/decorators';
import {
  CastcleException,
  CastcleStatus,
  ErrorMessages,
} from '@castcle-api/utils/exception';
import {
  CredentialInterceptor,
  CredentialRequest,
  HeadersRequest,
  TokenInterceptor,
  TokenRequest,
} from '@castcle-api/utils/interceptors';
import {
  Body,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseInterceptors,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AppService } from './app.service';
import { getEmailVerificationHtml } from './configs';
import {
  ChangePasswordBody,
  CheckEmailExistDto,
  CheckIdExistDto,
  CheckingResponse,
  GuestLoginDto,
  LoginDto,
  LoginResponse,
  otpResponse,
  RefreshTokenResponse,
  RegisterByEmailDto,
  RequestOtpDto,
  SocialConnectDto,
  SuggestCastcleIdReponse,
  TokenResponse,
  verificationOtpDto,
  VerificationPasswordBody,
} from './dtos/dto';
import {
  GuestInterceptor,
  GuestRequest,
} from './interceptors/guest.interceptor';

@CastcleController('1.0')
export class AuthenticationController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService
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
    @Body() { email }: CheckEmailExistDto
  ) {
    if (!this.authService.validateEmail(email))
      throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
    try {
      const account = await this.authService.getAccountFromEmail(email);
      return {
        message: 'success message',
        payload: {
          exist: account ? true : false,
        },
      };
    } catch (error) {
      throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
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
    @Body() { username, password }: LoginDto
  ) {
    try {
      const account = await this.authService.getAccountFromEmail(username);
      if (!account)
        throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
      if (await account.verifyPassword(password)) {
        const embedCredentialByDeviceUUID = account.credentials.find(
          (item) => item.deviceUUID === req.$credential.deviceUUID
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
            account
          );
        }
        console.debug('afterCredential', req.$credential);
        const userProfile = await this.appService.getUserProfile(
          req.$credential
        );

        const accessTokenPayload =
          await this.authService.getAccessTokenPayloadFromCredential(
            req.$credential
          );
        console.debug('accessTokenPayload', accessTokenPayload);
        const tokenResult: TokenResponse = await req.$credential.renewTokens(
          accessTokenPayload,
          {
            id: account._id as unknown as string,
          }
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
      } else
        throw new CastcleException(
          CastcleStatus.INVALID_EMAIL_OR_PASSWORD,
          req.$language
        );
    } catch (error) {
      throw new CastcleException(
        CastcleStatus.INVALID_EMAIL_OR_PASSWORD,
        req.$language
      );
    }
  }

  // PLAN : !!!
  /*@Post('loginWithSocial')
  loginWithSocial() {
    return {
      accessToken: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refreshToken: 'dmInNOX3-Pj_52rubA56xY37Na4EW3TPvwsj5SHiPF8'
    };
  }*/

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
      deviceUUID
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
        }
      );
      //update geolocation if current geolocaiton is not the same from service
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
    @Body() body: RegisterByEmailDto
  ) {
    if (body.channel === 'email') {
      //check if this account already sign up
      const currentAccount = await this.authService.getAccountFromCredential(
        req.$credential
      );
      if (
        currentAccount &&
        currentAccount.email &&
        currentAccount.email === body.payload.email
      )
        throw new CastcleException(
          CastcleStatus.EMAIL_OR_PHONE_IS_EXIST,
          req.$language
        );
      //check if account already activate
      //check if email exist and not the same
      if (await this.authService.getAccountFromEmail(body.payload.email))
        throw new CastcleException(
          CastcleStatus.EMAIL_OR_PHONE_IS_EXIST,
          req.$language
        );
      if (!this.authService.validateEmail(body.payload.email))
        throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
      //check if castcleId Exist
      const user = await this.authService.getExistedUserFromCastcleId(
        body.payload.castcleId
      );
      //validate password
      this.appService.validatePassword(body.payload.password, req.$language);
      if (user)
        throw new CastcleException(
          CastcleStatus.USER_ID_IS_EXIST,
          req.$language
        );
      const accountActivation = await this.authService.signupByEmail(
        currentAccount,
        {
          displayId: body.payload.castcleId,
          displayName: body.payload.displayName,
          email: body.payload.email,
          password: body.payload.password,
          referral: body.referral,
        }
      );
      //check if display id exist
      //send an email
      console.log('send email with token => ', accountActivation.verifyToken);
      await this.appService.sendRegistrationEmail(
        Host.getHostname(req),
        body.payload.email,
        accountActivation.verifyToken
      );
      //TODO !!! Need to improve this performance
      //make new token isGuest = false
      req.$credential.account.isGuest = false;
      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(
          req.$credential
        );

      const userProfile = await this.appService.getUserProfile(req.$credential);
      const tokenResult = await req.$credential.renewTokens(
        accessTokenPayload,
        {
          id: currentAccount._id as unknown as string,
        }
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
    throw new CastcleException(
      CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
      req.$language
    );
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
      req.$token
    );
    if (credential && credential.isRefreshTokenValid()) {
      const userProfile = await this.appService.getUserProfile(credential);

      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(credential);
      const newAccessToken = await credential.renewAccessToken(
        accessTokenPayload
      );

      const account = await this.authService.getAccountFromId(
        credential.account._id
      );
      return {
        profile: userProfile.profile
          ? await userProfile.profile.toUserResponse({
              passwordNotSet: account.password ? false : true,
            })
          : null,
        pages: userProfile.pages
          ? userProfile.pages.items.map((item) => item.toPageResponse())
          : null,
        accessToken: newAccessToken,
      } as RefreshTokenResponse;
    }
    throw new CastcleException(
      CastcleStatus.INVALID_REFRESH_TOKEN,
      req.$language
    );
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
      if (!account)
        throw new CastcleException(
          CastcleStatus.INVALID_REFRESH_TOKEN,
          req.$language
        );
      return '';
    }
    throw new CastcleException(
      CastcleStatus.INVALID_REFRESH_TOKEN,
      req.$language
    );
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
    @Res() response: Response
  ) {
    const accountActivation =
      await this.authService.getAccountActivationFromCredential(
        req.$credential
      );
    if (!accountActivation)
      throw new CastcleException(
        CastcleStatus.INVALID_REFRESH_TOKEN,
        req.$language
      );
    const newAccountActivation = await this.authService.revokeAccountActivation(
      accountActivation
    );
    if (!accountActivation)
      throw new CastcleException(
        CastcleStatus.INVALID_REFRESH_TOKEN,
        req.$language
      );
    if (accountActivation.activationDate) {
      const returnObj = {
        message: 'This email has been verified.',
      };
      response.status(200).json(returnObj);
      return returnObj;
    }
    const account = await this.authService.getAccountFromCredential(
      req.$credential
    );
    if (!(account && account.email))
      throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
    this.appService.sendRegistrationEmail(
      Host.getHostname(req),
      account.email,
      newAccountActivation.verifyToken
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
      body.castcleId
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
    type: otpResponse,
  })
  @CastcleBasicAuth()
  @Post('verificationOTP')
  @HttpCode(200)
  async verificationOTP(
    @Body() body: verificationOtpDto,
    @Req() req: CredentialRequest
  ) {
    this.logger.log(
      `Start verify OPT channel: ${body.channel} objective: ${body.objective} refCode: ${body.refCode}`
    );
    const otp = await this.appService.verificationOTP(body, req);
    if (otp && otp.isValid()) {
      const response: otpResponse = {
        objective: body.objective,
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString(),
      };
      return response;
    } else {
      throw new CastcleException(CastcleStatus.EXPIRED_OTP, req.$language);
    }
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    type: otpResponse,
  })
  @CastcleBasicAuth()
  @Post('requestOTP')
  @HttpCode(200)
  async requestOTP(@Body() body: RequestOtpDto, @Req() req: CredentialRequest) {
    this.logger.log(
      `Start request OPT channel: ${body.channel} objective: ${body.objective}`
    );
    const otp = await this.appService.requestOtpCode(body, req);
    if (otp && otp.isValid()) {
      const response: otpResponse = {
        objective: body.objective,
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString(),
      };
      return response;
    } else {
      throw new CastcleException(CastcleStatus.EXPIRED_OTP, req.$language);
    }
  }

  /*
   * TODO: !!! use for test link verification only will remove in production
   */
  @Version(VERSION_NEUTRAL)
  @Get('verify')
  async verify(@Req() req: CredentialRequest) {
    if (!req.query.code) {
      throw new CastcleException(CastcleStatus.REQUEST_URL_NOT_FOUND);
    }

    const token = req.query.code as string;
    await this.verificationEmail({
      $language: req.$language,
      $token: token,
    } as TokenRequest);
    const email = await this.authService.getEmailFromVerifyToken(token);

    return getEmailVerificationHtml(
      email,
      this.appService.getCastcleMobileLink(),
      Environment && Environment.SMTP_ADMIN_EMAIL
        ? Environment.SMTP_ADMIN_EMAIL
        : 'admin@castcle.com'
    );
  }

  @ApiOkResponse({
    type: SuggestCastcleIdReponse,
  })
  @Post('suggestCastcleId')
  @HttpCode(200)
  async suggestCastcleId(
    @Body('displayName') displayName: string
  ): Promise<SuggestCastcleIdReponse> {
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
    type: otpResponse,
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('verificationPassword')
  async verificationPassword(
    @Body() payload: VerificationPasswordBody,
    @Req() req: CredentialRequest
  ): Promise<otpResponse> {
    const objective: OtpObjective = <OtpObjective>payload.objective;
    if (
      !objective ||
      !Object.values(OtpObjective).includes(objective) ||
      objective !== OtpObjective.ChangePassword
    ) {
      this.logger.error(`Invalid objective.`);
      throw new CastcleException(
        CastcleStatus.PAYLOAD_TYPE_MISMATCH,
        req.$language
      );
    }

    const account = await this.authService.getAccountFromCredential(
      req.$credential
    );
    //add password checker
    this.appService.validatePassword(payload.password, req.$language);
    if (await account.verifyPassword(payload.password)) {
      const otp = await this.authService.generateOtp(
        account,
        objective,
        req.$credential.account._id,
        '',
        true
      );
      return {
        objective: payload.objective,
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString(),
      };
    } else
      throw new CastcleException(CastcleStatus.INVALID_PASSWORD, req.$language);
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
    @Req() req: CredentialRequest
  ) {
    const objective: OtpObjective = <OtpObjective>payload.objective;
    if (
      !objective ||
      !Object.values(OtpObjective).includes(objective) ||
      (objective !== OtpObjective.ChangePassword &&
        objective !== OtpObjective.ForgotPassword)
    ) {
      this.logger.error(`Invalid objective.`);
      throw new CastcleException(
        CastcleStatus.PAYLOAD_TYPE_MISMATCH,
        req.$language
      );
    }

    this.logger.log(`Start change password refCode: ${payload.refCode}`);
    return this.appService.resetPassword(payload, req);
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
  @CastcleTrack()
  @Post('login-with-social')
  async loginWithSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialConnectDto
  ) {
    this.logger.log(`login with social: ${body.provider}`);
    this.logger.log(`payload: ${JSON.stringify(body)}`);

    const { token, users, account } = await this.appService.socialLogin(
      body,
      req.$credential
    );
    if (!token) {
      this.logger.log(`response merge account.`);
      const error = ErrorMessages[CastcleStatus.DUPLICATE_EMAIL];
      throw new HttpException(
        {
          ...error,
          ...{
            payload: {
              profile: users.profile
                ? await users.profile.toUserResponse({
                    passwordNotSet: account.password ? false : true,
                  })
                : null,
            },
          },
        },
        400
      );
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
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @UseInterceptors(CredentialInterceptor)
  @Post('connect-with-social')
  @HttpCode(HttpStatus.NO_CONTENT)
  async connectWithSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialConnectDto
  ) {
    this.logger.log(`connect with social: ${body.provider}`);
    this.logger.log(`payload: ${JSON.stringify(body)}`);
    const socialAccount = await this.authService.getAccountAuthenIdFromSocialId(
      body.socialId,
      body.provider
    );
    if (socialAccount) {
      this.logger.error(`already connect social: ${body.provider}.`);
      throw new CastcleException(CastcleStatus.SOCIAL_PROVIDER_IS_EXIST);
    }

    const currentAccount = await this.authService.getAccountFromCredential(
      req.$credential
    );

    this.logger.log(`connect account with social`);
    await this.authService.createAccountAuthenId(
      currentAccount,
      body.provider,
      body.socialId,
      body.authToken ? body.authToken : undefined,
      undefined,
      body.avatar ? body.avatar : undefined,
      body.displayName ? body.displayName : undefined
    );
  }
}
