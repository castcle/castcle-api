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
import { AuthenticationService, UserService } from '@castcle-api/database';
import { DEFAULT_QUERY_OPTIONS } from '@castcle-api/database/dtos';
import {
  AccountDocument,
  CredentialDocument,
  OtpDocument,
  OtpObjective,
  UserDocument
} from '@castcle-api/database/schemas';
import { Environment as env } from '@castcle-api/environments';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { Password } from '@castcle-api/utils';
import { Downloader, Image, UploadOptions } from '@castcle-api/utils/aws';
import {
  AppleClient,
  FacebookAccessToken,
  FacebookClient,
  FacebookUserInfo,
  GoogleClient,
  TelegramClient,
  TelegramUserInfo,
  TwillioChannel,
  TwillioClient,
  TwitterAccessToken,
  TwitterClient,
  TwitterUserData
} from '@castcle-api/utils/clients';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AccessTokenResponse } from 'apple-sign-in-rest';
import * as nodemailer from 'nodemailer';
import { VerificationCheckInstance } from 'twilio/lib/rest/verify/v2/service/verificationCheck';
import { getSignupHtml } from './configs/signupEmail';
import {
  ChangePasswordBody,
  RequestOtpDto,
  SocialConnect,
  SocialConnectInfo,
  TokenResponse,
  verificationOtpDto
} from './dtos/dto';

const getIPUrl = (ip: string) =>
  env.IP_API_KEY
    ? `${env.IP_API_URL}/${ip}?fields=continentCode,countryCode&key=${env.IP_API_KEY}`
    : `${env.IP_API_URL}/${ip}?fields=continentCode,countryCode`;

/*
 * TODO: !!!
 */
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST ? env.SMTP_HOST : 'http://localhost:3334',
  port: env.SMTP_PORT ? env.SMTP_PORT : 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USERNAME ? env.SMTP_USERNAME : 'username', // generated ethereal user
    pass: env.SMTP_PASSWORD ? env.SMTP_PASSWORD : 'password' // generated ethereal password
  }
});

@Injectable()
export class AppService {
  constructor(
    private authService: AuthenticationService,
    private fbClient: FacebookClient,
    private download: Downloader,
    private telegramClient: TelegramClient,
    private twitterClient: TwitterClient,
    private googleClient: GoogleClient,
    private userService: UserService,
    private twillioClient: TwillioClient,
    private httpService: HttpService,
    private appleClient: AppleClient
  ) {}

  private readonly logger = new CastLogger(AppService.name, CastLoggerOptions);

  _uploadImage = (base64: string, options?: UploadOptions) =>
    Image.upload(base64, options);

  getData(): { message: string } {
    return { message: 'Welcome to authentications!' };
  }

  async sendRegistrationEmail(hostname: string, toEmail: string, code: string) {
    const verifyLink = `${hostname}/authentications/verify`;
    const info = await transporter.sendMail({
      from: 'castcle-noreply" <no-reply@castcle.com>',
      subject: 'Welcome to Castcle',
      to: toEmail,
      text: `Welcome to castcle here is a link embed code ${verifyLink}?code=${code}`,
      html: getSignupHtml(
        toEmail,
        `${verifyLink}?code=${code}`,
        'admin@castcle.com'
      )
    });
    console.log(`Email is send `, info.messageId, info);
  }

  /**
   * Validate if password pass Password.validate() if not will throw CastcleException
   * @param password
   * @param langagues en is default
   * @returns {boolean}
   */
  validatePassword(password: string, langagues?: string) {
    if (Password.validate(password)) return true;
    else {
      throw new CastcleException(CastcleStatus.INVALID_PASSWORD, langagues);
    }
  }

  /**
   * Create user and generate token for login social
   * @param {SocialConnect} social social response
   * @param {CredentialDocument} credential
   * @returns {TokenResponse}
   */
  async socialLogin(social: SocialConnect, credential: CredentialDocument) {
    this.logger.log('get AccountFromCredential');
    const currentAccount = await this.authService.getAccountFromCredential(
      credential
    );

    this.logger.log('get AccountAuthenIdFromSocialId');
    const socialAccount = await this.authService.getAccountAuthenIdFromSocialId(
      social.socialId,
      social.provider
    );

    this.logger.log('get UserFromAccountId');
    const user = await this.authService.getUserFromAccountId(credential);

    if (!socialAccount) {
      currentAccount.email = currentAccount.email
        ? social.email
        : currentAccount.email;
      if (user.length === 0) {
        this.logger.log(`download avatar from ${social.provider}`);
        const img = await this.download.getImageFromUrl(social.profileImage);

        this.logger.log('upload avatar to s3');

        const avatar = await this._uploadImage(img, {
          filename: `avatar-${credential.account._id}`
        });

        this.logger.log('signup by Social');
        await this.authService.signupBySocial(currentAccount, {
          displayName: social.name,
          socialId: social.socialId,
          provider: social.provider,
          avatar: avatar.image.original,
          socialToken: social.socialToken,
          socialSecretToken: social.socialSecretToken
        });
      } else {
        await this.authService.createAccountAuthenId(
          currentAccount,
          social.provider,
          social.socialId,
          social.socialToken,
          social.socialSecretToken
        );
      }
    }

    this.logger.log('get AccessTokenPayload FromCredential');
    const accessTokenPayload =
      await this.authService.getAccessTokenPayloadFromCredential(credential);
    this.logger.log('renew Tokens');
    const tokenResult: TokenResponse = await credential.renewTokens(
      accessTokenPayload,
      {
        id: currentAccount._id as unknown as string
      }
    );
    return tokenResult;
  }

  /**
   * Connect Facebook API
   * @param {string} accessToken access token from facebook
   * @param {string} language en is default
   * @returns {FacebookUserInfo}
   */
  async facebookConnect(authToken: string, language: string) {
    if (!authToken) {
      this.logger.error(`token missing.`);
      throw new CastcleException(CastcleStatus.INVLAID_AUTH_TOKEN, language);
    }

    this.logger.log(`get facebook access token.`);
    const fbToken: FacebookAccessToken = await this.fbClient.getAccessToken();

    this.logger.log(`verify fcaebook user token.`);
    const tokenVerify = await this.fbClient.verifyUserToken(
      fbToken.access_token,
      authToken
    );

    if (!tokenVerify.is_valid) {
      this.logger.error(`Use token expired.`);
      throw new CastcleException(CastcleStatus.INVLAID_AUTH_TOKEN, language);
    }
    this.logger.log(`get fcaebook user data.`);
    let user: FacebookUserInfo;
    try {
      user = await this.fbClient.getUserInfo(authToken);
    } catch (error) {
      this.logger.error(`Can't get user data.`);
      this.logger.error(error);
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, language);
    }

    return user;
  }

  /**
   * Connect Telegram
   * @param {SocialConnectInfo} payload response from telegram
   * @param {string} language en is default
   * @returns {boolean}
   */
  async telegramConnect(payload: SocialConnectInfo, language: string) {
    this.logger.log('Validate Data');
    if (
      !payload ||
      !payload.socialUser.id ||
      !payload.socialUser.first_name ||
      !payload.socialUser.last_name ||
      !payload.socialUser.username ||
      !payload.socialUser.auth_date ||
      !payload.hash
    ) {
      this.logger.error(`payload data missing.`);
      throw new CastcleException(CastcleStatus.PAYLOAD_TYPE_MISMATCH, language);
    }

    const message: TelegramUserInfo = {
      id: payload.socialUser.id,
      first_name: payload.socialUser.first_name,
      last_name: payload.socialUser.last_name,
      username: payload.socialUser.username,
      photo_url: payload.socialUser.photo_url
        ? payload.socialUser.photo_url
        : '',
      auth_date: payload.socialUser.auth_date,
      hash: payload.hash
    };
    this.logger.log('Validate Hash');
    return await this.telegramClient.verifyUserToken(message);
  }

  /**
   * Connect Twitter API
   * @param {SocialConnectInfo} payload response from twitter
   * @param {string} language en is default
   * @returns {TwitterUserData, TwitterAccessToken}
   */
  async twitterConnect(payload: SocialConnectInfo, language: string) {
    if (
      !payload.authToken ||
      !payload.authTokenSecret ||
      !payload.authVerifierToken
    ) {
      this.logger.error(`token missing.`);
      throw new CastcleException(CastcleStatus.INVLAID_AUTH_TOKEN, language);
    }

    this.logger.log(`get twitter access token.`);
    const tokenData: TwitterAccessToken =
      await this.twitterClient.requestAccessToken(
        payload.authToken,
        payload.authTokenSecret,
        payload.authVerifierToken
      );

    if (!tokenData) {
      this.logger.error(`Use token expired.`);
      throw new CastcleException(CastcleStatus.INVLAID_AUTH_TOKEN, language);
    }

    this.logger.log(`verify twitter user token.`);
    const userVerify: TwitterUserData =
      await this.twitterClient.requestVerifyToken(
        tokenData.oauth_token,
        tokenData.oauth_token_secret
      );

    if (!userVerify) {
      this.logger.error(`Can't get user data.`);
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, language);
    }

    return { userVerify, tokenData };
  }

  /**
   * Request Access Twitter Token API
   * @param {string} language en is default
   * @returns {oauth_token,oauth_token_secret,oauth_callback_confirmed} token data
   */
  async twitterRequestToken(language: string) {
    const data = await this.twitterClient.requestToken();
    this.logger.log(
      `Twitter callback confirmed status : ${data.results.oauth_callback_confirmed}`
    );

    if (data.results.oauth_callback_confirmed === 'true') return data;
    else throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, language);
  }

  /**User Profile and Pages
   * @param {CredentialDocument} credential
   * @returns {profile,pages} profile data
   */
  async getUserProfile(credential: CredentialDocument) {
    const user = await this.userService.getUserFromCredential(credential);
    const pages = user
      ? await this.userService.getUserPages(user, {
          limit: 1000,
          page: DEFAULT_QUERY_OPTIONS.page,
          sortBy: DEFAULT_QUERY_OPTIONS.sortBy
        })
      : null;

    return {
      profile: user,
      pages: pages
    };
  }

  /**
   * get and validate account from email
   * @param {string} email
   * @param {string} lang
   * @returns {AccountDocument} account document
   */
  async getAccountFromEmail(email: string, lang: string) {
    this.logger.log('Get Account from eamil');
    const account = await this.authService.getAccountFromEmail(email);
    if (!account)
      throw new CastcleException(CastcleStatus.EMAIL_OR_PHONE_NOTFOUND, lang);

    return account;
  }

  /**
   * get and validate account from mobile
   * @param {string} mobileNumber
   * @param {string} countryCode
   * @param {string} lang
   * @returns {AccountDocument} account document
   */
  async getAccountFromMobile(
    mobileNumber: string,
    countryCode: string,
    lang: string
  ) {
    const mobile =
      mobileNumber.charAt(0) === '0' ? mobileNumber.slice(1) : mobileNumber;
    this.logger.log('Get Account from mobile');
    const account = await this.authService.getAccountFromMobile(
      mobile,
      countryCode
    );
    if (!account) {
      this.logger.error(
        'Can not get Account from mobile : ' + countryCode + mobile
      );
      throw new CastcleException(CastcleStatus.EMAIL_OR_PHONE_NOTFOUND, lang);
    }

    return account;
  }

  private async validateExistingOtp(
    objective: OtpObjective,
    credential: CredentialRequest,
    channel: string
  ) {
    const allExistingOtp =
      await this.authService.getAllOtpFromRequestIdObjective(
        credential.$credential.account._id
      );

    let existingOtp = null;
    for (const { exOtp } of allExistingOtp.map((exOtp) => ({ exOtp }))) {
      if (
        exOtp.isValid() &&
        exOtp.channel === channel &&
        exOtp.action === objective
      ) {
        existingOtp = exOtp;
      } else {
        try {
          if (exOtp.sid) await this.twillioClient.canceledOtp(exOtp.sid);
        } catch (ex) {
          this.logger.warn('Can not cancel otp:', ex);
        }
        this.logger.log('Delete OTP refCode: ' + exOtp.refCode);
        await exOtp.delete();
      }
    }

    return existingOtp;
  }

  /**
   * forgot password request Otp
   * @param {RequestOtpDto} request
   * @param {CredentialRequest} credential
   * @returns {OtpDocument} Opt data
   */
  async requestOtpCode(request: RequestOtpDto, credential: CredentialRequest) {
    let account: AccountDocument = null;
    let otp: OtpDocument = null;
    const objective: OtpObjective = <OtpObjective>request.objective;

    if (!objective || !Object.values(OtpObjective).includes(objective)) {
      this.logger.error(`Invalid objective.`);
      throw new CastcleException(
        CastcleStatus.PAYLOAD_TYPE_MISMATCH,
        credential.$language
      );
    }

    const exOtp = await this.validateExistingOtp(
      objective,
      credential,
      request.channel
    );
    if (exOtp) {
      this.logger.log('Already has Otp. ref code : ' + exOtp.refCode);
      return exOtp;
    }

    switch (request.channel) {
      case 'email': {
        account = await this.getAccountFromEmail(
          request.payload.email,
          credential.$language
        );

        this.logger.log('Create Otp');
        otp = await this.generateAndSendOtp(
          account.email,
          account,
          TwillioChannel.Email,
          objective,
          credential,
          request.channel
        );
        break;
      }
      case 'mobile': {
        account = await this.getAccountFromMobile(
          request.payload.mobileNumber,
          request.payload.countryCode,
          credential.$language
        );

        this.logger.log('Create OTP');
        otp = await this.generateAndSendOtp(
          account.mobile.countryCode + account.mobile.number,
          account,
          TwillioChannel.Mobile,
          objective,
          credential,
          request.channel
        );
        break;
      }
      default: {
        this.logger.error(`Forgot password channel mismatch.`);
        throw new CastcleException(
          CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
          credential.$language
        );
      }
    }
    return otp;
  }

  /**
   * generate and send Otp
   * @param {string} reciever
   * @param {AccountDocument} account
   * @param {TwillioChannel} account
   * @returns {OtpDocument} Opt data
   */
  async generateAndSendOtp(
    reciever: string,
    account: AccountDocument,
    twillioChannel: TwillioChannel,
    objective: OtpObjective,
    credential: CredentialRequest,
    otpChannel: string
  ): Promise<OtpDocument> {
    let sid = '';
    this.logger.log('Send Otp');
    try {
      this.logger.log('get user from account');
      const user = await this.authService.getUserFromAccount(account);
      const result = await this.twillioClient.requestOtp(
        reciever,
        twillioChannel,
        this.buildTemplateMessage(objective, user)
      );
      sid = result.sid;
    } catch (ex) {
      this.logger.error('Twillio Error : ' + ex.message, ex);
    }

    this.logger.log('Generate Ref Code');
    const otp = await this.authService.generateOtp(
      account,
      objective,
      credential.$credential.account._id,
      otpChannel,
      false,
      sid
    );
    return otp;
  }

  private buildTemplateMessage(objective: OtpObjective, user: UserDocument) {
    const userName = user && user.displayName ? user.displayName : '';
    if (objective === OtpObjective.ForgotPassword) {
      this.logger.log('build template forgot password objective');
      return {
        twilio_name: userName,
        twilio_message_body:
          'We received a request to reset your  Castcle password. Enter the following password reset code',
        twilio_message_footer_1: 'Didn’t request this change?',
        twilio_message_footer_2: 'If you didn’t request a new password'
      };
    } else {
      this.logger.log('build template other objective');
      return {
        twilio_name: userName,
        twilio_message_body:
          'We received a request for One Time Password (OTP).',
        twilio_message_footer_1: 'Didn’t request this change?',
        twilio_message_footer_2: ''
      };
    }
  }
  /**
   * forgot password verify Otp
   * @param {verificationOtpDto} request
   * @param {CredentialRequest} credential
   * @returns {OtpDocument} Opt data
   */
  async verificationOTP(
    request: verificationOtpDto,
    credential: CredentialRequest
  ) {
    const limitRetry = 3;
    let account: AccountDocument = null;
    let receiver = '';

    const objective: OtpObjective = <OtpObjective>request.objective;
    if (!objective || !Object.values(OtpObjective).includes(objective)) {
      this.logger.error(`Invalid objective.`);
      throw new CastcleException(
        CastcleStatus.PAYLOAD_TYPE_MISMATCH,
        credential.$language
      );
    }

    switch (request.channel) {
      case 'email': {
        account = await this.getAccountFromEmail(
          request.payload.email,
          credential.$language
        );
        receiver = account.email;
        break;
      }
      case 'mobile': {
        account = await this.getAccountFromMobile(
          request.payload.mobileNumber,
          request.payload.countryCode,
          credential.$language
        );
        receiver = account.mobile.countryCode + account.mobile.number;

        break;
      }
      default: {
        this.logger.error(`Verify password channel mismatch.`);
        throw new CastcleException(
          CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
          credential.$language
        );
      }
    }

    this.logger.log('Get Account from OTP');
    const otp = await this.authService.getOtpFromRequestIdRefCode(
      credential.$credential.account._id,
      request.refCode
    );

    if (!otp) {
      this.logger.error(`Invalid ref code: ${request.refCode}`);
      throw new CastcleException(
        CastcleStatus.INVLAID_REFCODE,
        credential.$language
      );
    } else if (otp.action !== objective) {
      this.logger.error(`Invalid objective.`);
      throw new CastcleException(
        CastcleStatus.PAYLOAD_TYPE_MISMATCH,
        credential.$language
      );
    } else if (otp.channel !== request.channel) {
      this.logger.error(`Verify password channel mismatch.`);
      throw new CastcleException(
        CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
        credential.$language
      );
    }

    const retryCount = otp.retry ? otp.retry : 0;
    if (retryCount >= limitRetry) {
      this.logger.error(`Otp over limit retry : ${limitRetry}`);
      await otp.delete();
      throw new CastcleException(
        CastcleStatus.LOCKED_OTP,
        credential.$language
      );
    }

    if (otp && otp.isValid()) {
      this.logger.log('Verify otp with twillio');
      let verifyOtpResult: VerificationCheckInstance;
      try {
        verifyOtpResult = await this.twillioClient.verifyOtp(
          receiver,
          request.otp
        );
      } catch (ex) {
        this.logger.error(ex.message, ex);
        await otp.delete();
        throw new CastcleException(
          CastcleStatus.EXPIRED_OTP,
          credential.$language
        );
      }

      this.logger.log('Twillio result : ' + verifyOtpResult.status);
      if (!verifyOtpResult || verifyOtpResult.status !== 'approved') {
        await this.authService.updateRetryOtp(otp);
        this.logger.error(`Invalid Otp.`);
        throw new CastcleException(
          CastcleStatus.INVALID_OTP,
          credential.$language
        );
      }

      this.logger.log('delete old otp');
      await otp.delete();

      this.logger.log('generate new otp with verify pass');
      const newOtp = await this.authService.generateOtp(
        account,
        objective,
        credential.$credential.account._id,
        request.channel,
        true
      );
      return newOtp;
    } else {
      this.logger.error(`Otp expired.`);
      this.logger.log('Delete OTP refCode: ' + otp.refCode);
      await otp.delete();
      throw new CastcleException(
        CastcleStatus.EXPIRED_OTP,
        credential.$language
      );
    }
  }

  /**
   * reset password
   * @param {ChangePasswordBody} data
   * @param {CredentialRequest} credential
   * @returns {string} empty string
   */
  async resetPassword(data: ChangePasswordBody, credential: CredentialRequest) {
    this.logger.log('Get otp document');
    const otp = await this.authService.getOtpFromRequestIdRefCode(
      credential.$credential.account._id,
      data.refCode
    );

    if (
      otp &&
      otp.isValid() &&
      (otp.action === OtpObjective.ChangePassword ||
        otp.action === OtpObjective.ForgotPassword) &&
      otp.isVerify
    ) {
      this.logger.log('Validate password');
      this.validatePassword(data.newPassword, credential.$language);
      this.logger.log('Get Account');
      const account = await this.authService.getAccountFromId(otp.account._id);
      this.logger.log('Change password');
      const result = await this.authService.changePassword(
        account,
        otp,
        data.newPassword
      );
      return '';
    } else {
      this.logger.error(`Invalid Ref Code`);
      throw new CastcleException(
        CastcleStatus.INVLAID_REFCODE,
        credential.$language
      );
    }
  }

  /**
   * Connect Apple API
   * @param {SocialConnectInfo} payload response from twitter
   * @param {string} language en is default
   * @returns {AppleIdTokenType}
   */
  async appleConnect(payload: SocialConnectInfo, language: string) {
    if (
      !payload.authToken ||
      !payload.socialUser ||
      !payload.socialUser.first_name ||
      !payload.socialUser.last_name ||
      !payload.socialUser.email
    ) {
      this.logger.error(`payload missing.`);
      throw new CastcleException(CastcleStatus.PAYLOAD_TYPE_MISMATCH, language);
    }

    let tokenDetail: AccessTokenResponse;
    if (payload.code) {
      this.logger.log(`authorize apple user token.`);
      tokenDetail = await this.appleClient.authorizationToken(
        payload.code,
        payload.redirectUrl
      );
    }

    this.logger.log(`verify apple user token.`);
    const userVerify = await this.appleClient.verifyToken(
      payload.authToken,
      payload.socialUser.id
    );

    if (!userVerify) {
      this.logger.error(`Can't get user data.`);
      throw new CastcleException(CastcleStatus.INVLAID_AUTH_TOKEN, language);
    }
    return { user: userVerify, token: tokenDetail };
  }

  /**
   * Connect Google API
   * @param {SocialConnectInfo} payload response from google
   * @param {string} language en is default
   * @returns {TwitterUserData, TwitterAccessToken}
   */
  async googleConnect(payload: SocialConnectInfo, language: string) {
    if (!payload.authToken) {
      this.logger.error(`token missing.`);
      throw new CastcleException(CastcleStatus.PAYLOAD_TYPE_MISMATCH, language);
    }

    this.logger.log(`verify google access token.`);
    const tokenData = await this.googleClient.verifyToken(payload.authToken);

    if (!tokenData) {
      this.logger.error(`Use token expired.`);
      throw new CastcleException(CastcleStatus.INVLAID_AUTH_TOKEN, language);
    }

    this.logger.log(`verify google user token.`);
    const userVerify = await this.googleClient.getGoogleUserInfo(
      payload.authToken
    );

    if (!userVerify) {
      this.logger.error(`Can't get user data.`);
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, language);
    }

    return { userVerify, tokenData };
  }
}
