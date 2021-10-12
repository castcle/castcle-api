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
import { CommonDate } from '@castcle-api/commonDate';
import { AuthenticationService } from '@castcle-api/database';
import { AccountAuthenIdType } from '@castcle-api/database/schemas';
import { Configs } from '@castcle-api/environments';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { Host } from '@castcle-api/utils';
import { FacebookClient } from '@castcle-api/utils/clients';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import {
  CredentialInterceptor,
  CredentialRequest,
  HeadersRequest,
  TokenInterceptor,
  TokenRequest
} from '@castcle-api/utils/interceptors';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseInterceptors,
  Version,
  VERSION_NEUTRAL
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiResponse
} from '@nestjs/swagger';
import { Request } from 'express';
import { AppService } from './app.service';
import {
  ChangePasswordBody,
  CheckEmailExistDto,
  CheckIdExistDto,
  CheckingResponse,
  GuestLoginDto,
  LoginDto,
  RefreshTokenResponse,
  RegisterByEmailDto,
  SocialConnectDto,
  SuggestCastcleIdReponse,
  TokenResponse,
  VerificationPasswordBody,
  VerificationPasswordResponse,
  ForgotPasswordRequestOtpDto,
  ForgotPasswordResponse,
  ForgotPasswordVerificationOtpDto,
  ResetPasswordDto
} from './dtos/dto';
import {
  GuestInterceptor,
  GuestRequest
} from './interceptors/guest.interceptor';
import { UserAccessTokenPayload } from '@castcle-api/database/dtos';
import { AccountDocument, OtpDocument } from '@castcle-api/database/schemas';

@ApiHeader({
  name: Configs.RequiredHeaders.AcceptLanguague.name,
  description: Configs.RequiredHeaders.AcceptLanguague.description,
  example: Configs.RequiredHeaders.AcceptLanguague.example,
  required: true
})
@ApiHeader({
  name: Configs.RequiredHeaders.AcceptVersion.name,
  description: Configs.RequiredHeaders.AcceptVersion.description,
  example: Configs.RequiredHeaders.AcceptVersion.example,
  required: true
})
@Controller({
  version: '1.0'
})
export class AuthenticationController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService,
    private fbClient: FacebookClient
  ) {}
  private readonly logger = new CastLogger(
    AuthenticationController.name,
    CastLoggerOptions
  );

  @ApiResponse({
    status: 400,
    description: 'will show if some of header is missing'
  })
  @ApiOkResponse({
    status: 201,
    type: CheckingResponse
  })
  @ApiBody({
    type: CheckEmailExistDto
  })
  @Post('checkEmailExists')
  @HttpCode(200)
  async checkEmailExists(
    @Req() req: HeadersRequest,
    @Body('email') email: string
  ) {
    //if there is no email in the request and email is not valid (not email )
    if (!(email && this.authService.validateEmail(email)))
      throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
    try {
      const account = await this.authService.getAccountFromEmail(email);
      return {
        message: 'success message',
        payload: {
          exist: account ? true : false // true=มีในระบบ, false=ไม่มีในระบบ
        }
      };
    } catch (error) {
      throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
    }
  }

  @ApiBearerAuth()
  @ApiBody({
    type: LoginDto
  })
  @ApiOkResponse({
    status: 200,
    type: TokenResponse
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('login')
  @HttpCode(200)
  async login(@Req() req: CredentialRequest, @Body() body: LoginDto) {
    try {
      const account = await this.authService.getAccountFromEmail(body.username);

      if (!account)
        throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
      if (await account.verifyPassword(body.password)) {
        const embedCredentialByDeviceUUID = account.credentials.find(
          (item) => item.deviceUUID === req.$credential.deviceUUID
        );
        console.debug(
          'embedCredentialByDeviceUUID',
          embedCredentialByDeviceUUID
        );
        if (embedCredentialByDeviceUUID) {
          req.$credential = await this.authService._credentialModel
            .findById(embedCredentialByDeviceUUID._id)
            .exec();
        } else {
          req.$credential = await this.authService.linkCredentialToAccount(
            req.$credential,
            account
          );
        }
        console.debug('afterCredential', req.$credential);
        const accessTokenPayload =
          await this.authService.getAccessTokenPayloadFromCredential(
            req.$credential
          );
        console.debug('accessTokenPayload', accessTokenPayload);
        const tokenResult: TokenResponse = await req.$credential.renewTokens(
          accessTokenPayload,
          {
            id: account._id as unknown as string,
            role: account.activateDate ? 'member' : 'guest'
          }
        );
        return {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken
        } as TokenResponse;
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
    required: true
  })
  @ApiHeader({
    name: 'Platform',
    description: 'platform',
    example: 'android',
    required: true
  })
  @ApiOkResponse({
    type: TokenResponse
  })
  @ApiBody({
    type: GuestLoginDto
  })
  @ApiResponse({
    status: 400,
    description: 'will show if some of header is missing'
  })
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
          preferredLanguage: [req.$language]
        },
        {
          id: credential.account._id as unknown as string,
          role: 'guest'
        }
      );
      return tokenResult;
    } else {
      const result = await this.authService.createAccount({
        device: req.$device,
        deviceUUID: deviceUUID,
        header: { platform: req.$platform },
        languagesPreferences: [req.$language]
      });
      return {
        accessToken: result.credentialDocument.accessToken,
        refreshToken: result.credentialDocument.refreshToken
      } as TokenResponse;
    }
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    type: TokenResponse
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
      const user = await this.authService.getUserFromCastcleId(
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
          password: body.payload.password
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
      const tokenResult: TokenResponse = await req.$credential.renewTokens(
        accessTokenPayload,
        {
          id: currentAccount._id as unknown as string,
          role: 'member'
        }
      );
      return tokenResult;
    }
    throw new CastcleException(
      CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
      req.$language
    );
  }

  @ApiResponse({
    status: 201,
    type: RefreshTokenResponse
  })
  @ApiResponse({
    status: 400,
    description:
      'will show if some of header is missing or invalid refresh token'
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
      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(credential);
      const newAccessToken = await credential.renewAccessToken(
        accessTokenPayload
      );
      return {
        accessToken: newAccessToken
      };
    }
    throw new CastcleException(
      CastcleStatus.INVALID_REFRESH_TOKEN,
      req.$language
    );
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 204
  })
  @ApiResponse({
    status: 403,
    description: 'will reject if token is invalid'
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
    status: 204
  })
  @ApiResponse({
    status: 403,
    description: 'will reject if token is invalid'
  })
  @Post('requestLinkVerify')
  @HttpCode(204)
  @UseInterceptors(CredentialInterceptor)
  async requestLinkVerify(@Req() req: CredentialRequest) {
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
    return '';
  }

  @ApiOkResponse({
    type: CheckingResponse
  })
  @Post('checkCastcleIdExists')
  @HttpCode(200)
  async checkCastcleIdExists(@Body() body: CheckIdExistDto) {
    const user = await this.authService.getUserFromCastcleId(body.castcleId);
    return {
      message: 'success message',
      payload: {
        exist: user ? true : false // true=มีในระบบ, false=ไม่มีในระบบ
      }
    } as CheckingResponse;
  }

  // PLAN : !!!
  /* @Post('requestOTP')
  requestOTP() {
    return {
      refCode: 'xxxxxxxx', // 8 หลัก
      objective: 'mergeAccount',
      expiresTime: '2021–06–16T11:22:33Z' // 5 นาทีจาก create
    };
  }

  @Post('verificationOTP')
  @HttpCode(204)
  verificationOTP() {
    return '';
  }

  @Post('forgotPasswordRequestOTP')
  forgotPasswordRequestOTP() {
    return {
      refCode: 'xxxxxxxx', // 8 หลัก
      expiresTime: '2021–06–16T11:22:33Z' // 5 นาทีจาก create
    };
  }*/

  @Get()
  getData() {
    const dt = new CommonDate();
    const birthDay = dt.getDateFormat(
      dt.getDateFromString('1981-11-10', 'YYYY-MM-DD'),
      'DD-MM-YY'
    );
    this.logger.log('Root');
    return this.appService.getData().message + birthDay;
  }

  @Version('beta')
  @Get()
  getDataBeta() {
    return 'hello';
  }

  /*
   * TODO: !!! use for test link verification only will remove in production
   */
  @Version(VERSION_NEUTRAL)
  @Get('verify')
  verify(@Req() req: Request) {
    const verifyUrl =
      Host.getHostname(req) + '/authentications/verificationEmail';
    if (req.query.code) {
      return `Verifying you will get a pop up once the process is done.<script>fetch("${verifyUrl}", {
        headers: {
          "Accept-Version": "1.0",
          Accept: "*/*",
          "Accept-Language": "th",
          Authorization: "Bearer ${req.query.code}"
        },
        method: "POST"
      }).then(r => r.json()).then(r => { console.log(r);alert('verification success');})</script>`;
    } else throw new CastcleException(CastcleStatus.REQUEST_URL_NOT_FOUND);
  }

  @ApiOkResponse({
    type: SuggestCastcleIdReponse
  })
  @Post('suggestCastcleId')
  @HttpCode(200)
  async suggestCastcleId(
    @Body('displayName') displayName: string,
    @Req() req: CredentialRequest
  ): Promise<SuggestCastcleIdReponse> {
    const suggestId = await this.authService.suggestCastcleId(displayName);
    return {
      payload: {
        suggestCastcleId: suggestId
      }
    };
  }

  @ApiBody({
    type: VerificationPasswordBody
  })
  @ApiResponse({
    status: 201,
    type: VerificationPasswordResponse
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('verificationPassword')
  async verificationPassword(
    @Body('password') password: string,
    @Req() req: CredentialRequest
  ): Promise<VerificationPasswordResponse> {
    //req.$credential.
    const account = await this.authService.getAccountFromCredential(
      req.$credential
    );
    //add password checker
    this.appService.validatePassword(password, req.$language);
    if (account.verifyPassword(password)) {
      const otp = await this.authService.generateOtp(account);
      return {
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString()
      };
    } else
      throw new CastcleException(CastcleStatus.INVALID_PASSWORD, req.$language);
  }

  @UseInterceptors(CredentialInterceptor)
  @ApiBody({
    type: ChangePasswordBody
  })
  @ApiResponse({
    status: 204
  })
  @Post('changePasswordSubmit')
  @HttpCode(204)
  async changePasswordSubmit(
    @Body('refCode') refCode: string,
    @Body('newPassword') newPassword: string,
    @Req() req: CredentialRequest
  ) {
    const account = await this.authService.getAccountFromCredential(
      req.$credential
    );
    this.appService.validatePassword(newPassword, req.$language);
    const otp = await this.authService.getOtpFromAccount(account, refCode);
    if (otp && otp.isValid()) {
      //change password
      const result = await this.authService.changePassword(
        account,
        otp,
        newPassword
      );
      return '';
    } else
      throw new CastcleException(CastcleStatus.INVLAID_REFCODE, req.$language);
  }

  @ApiBearerAuth()
  @ApiBody({
    type: SocialConnectDto
  })
  @ApiOkResponse({
    status: 200,
    type: TokenResponse
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('loginWithSocial')
  @HttpCode(200)
  async loginWithSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialConnectDto
  ) {
    let token: TokenResponse;
    this.logger.log(`login with social: ${body.provider}`);
    switch (body.provider) {
      case AccountAuthenIdType.Facebook: {
        const userFB = await this.appService.facebookConnect(
          body.payload.authToken,
          req.$language
        );
        if (userFB) {
          this.logger.log(`social login`);
          token = await this.appService.socialLogin(
            {
              socialId: userFB.id,
              email: userFB.email ? userFB.email : '',
              name: userFB.name,
              provider: AccountAuthenIdType.Facebook,
              profileImage: userFB.picture.data.url,
              socialToken: body.payload.authToken
            },
            req.$credential
          );
        } else {
          this.logger.error(`Can't get user data.`);
          throw new CastcleException(
            CastcleStatus.FORBIDDEN_REQUEST,
            req.$language
          );
        }
        break;
      }
    }
    return token;
  }

  @ApiBearerAuth()
  @ApiBody({
    type: SocialConnectDto
  })
  @ApiOkResponse({
    status: 200,
    type: TokenResponse
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('connectWithSocial')
  @HttpCode(200)
  async connectWithSocial(
    @Req() req: CredentialRequest,
    @Body() body: SocialConnectDto
  ) {
    this.logger.log(`connect with social: ${body.provider}`);
    const currentAccount = await this.authService.getAccountFromCredential(
      req.$credential
    );
    switch (body.provider) {
      case AccountAuthenIdType.Facebook: {
        const userFB = await this.appService.facebookConnect(
          body.payload.authToken,
          req.$language
        );

        if (userFB) {
          this.logger.log('get AccountAuthenIdFromSocialId');
          const socialAccount =
            await this.authService.getAccountAuthenIdFromSocialId(
              userFB.id,
              AccountAuthenIdType.Facebook
            );
          if (!socialAccount) {
            await this.authService.createAccountAuthenId(
              currentAccount,
              AccountAuthenIdType.Facebook,
              userFB.id,
              body.payload.authToken
            );
          } else {
            this.logger.warn(`already connect social: ${body.provider}.`);
          }
        } else {
          this.logger.error(`Can't get user data.`);
          throw new CastcleException(
            CastcleStatus.FORBIDDEN_REQUEST,
            req.$language
          );
        }
        break;
      }
    }
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    type: TokenResponse
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('forgotPasswordRequestOTP')
  async forgotPasswordRequestOTP(
    @Body() body: ForgotPasswordRequestOtpDto,
    @Req() req: CredentialRequest
  ) {
    let account: AccountDocument = null;
    let otp: OtpDocument = null;
    if (body.channel === 'email') {
      account = await this.authService.getAccountFromEmail(body.payload.email);
      if (this.checkValidAccount(account, req)) {
        otp = await this.authService.forgotPasswordRequestOtpByEmail(account);
      }
    } else if (body.channel === 'mobile') {
      // TODO !!! wait findAccountByMobileNumber
      // account = await this.authService.getAccountFromMobileNo(
      //   body.payload.countryCode,
      //   body.payload.mobileNumber
      // );
      // if (this.checkValidAccount(account, req)) {
      //   otp = await this.authService.forgotPasswordRequestByMobile(account);
      // }
    } else {
      throw new CastcleException(
        CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
        req.$language
      );
    }
    if (otp && otp.isValid()) {
      const response: ForgotPasswordResponse = {
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString()
      };
      return response;
    } else {
      throw new CastcleException(CastcleStatus.EXPIRED_OTP, req.$language);
    }
  }

  checkValidAccount(account: AccountDocument, req: CredentialRequest): boolean {
    if (!account) {
      throw new CastcleException(
        CastcleStatus.EMAIL_OR_PHONE_NOTFOUND,
        req.$language
      );
    }
    return true;
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    type: TokenResponse
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('forgotPasswordVerificationOTP')
  async forgotPasswordVerificationOTP(
    @Body() body: ForgotPasswordVerificationOtpDto,
    @Req() req: CredentialRequest
  ) {
    let account: AccountDocument = null;
    if (body.channel === 'email') {
      account = await this.authService.getAccountFromEmail(body.payload.email);
    } else if (body.channel === 'mobile') {
      // TODO !!! wait findAccountByMobileNumber
      // account = await this.authService.getAccountFromMobileNo(
      //   body.payload.countryCode,
      //   body.payload.mobileNumber
      // );
      account.mobile.countryCode = body.payload.countryCode;
      account.mobile.number = body.payload.mobileNumber;
    } else {
      throw new CastcleException(
        CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
        req.$language
      );
    }
    if (!account.$isValid) {
      throw new CastcleException(
        CastcleStatus.INVALID_EMAIL_OR_PASSWORD,
        req.$language
      );
    }
    const otp = await this.authService.forgotPasswordVerificationOtp(
      body.channel,
      account,
      body.refCode,
      body.otp
    );
    if (otp && otp.isValid()) {
      const response: ForgotPasswordResponse = {
        refCode: otp.refCode,
        expiresTime: otp.expireDate.toISOString()
      };
      return response;
    } else {
      throw new CastcleException(CastcleStatus.EXPIRED_OTP, req.$language);
    }
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    type: TokenResponse
  })
  @UseInterceptors(CredentialInterceptor)
  @Post('resetPasswordSubmit')
  async resetPasswordSubmit(
    @Body() body: ResetPasswordDto,
    @Req() req: CredentialRequest
  ) {
    await this.authService.resetPassword(body.refCode, body.newPassword);
  }
}
