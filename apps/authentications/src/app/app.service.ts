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
import {
  AccountDocument,
  CredentialDocument,
  OtpObjective
} from '@castcle-api/database/schemas';
import { Environment as env } from '@castcle-api/environments';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { MobileNumber, Password } from '@castcle-api/utils';
import { Downloader, Image, UploadOptions } from '@castcle-api/utils/aws';
import {
  FacebookAccessToken,
  FacebookClient,
  FacebookUserInfo,
  TelegramClient,
  TelegramUserInfo
} from '@castcle-api/utils/clients';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { EChannelType, TwilioService } from '@castcle-api/utils/twilio';
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { VerificationInstance } from 'twilio/lib/rest/verify/v2/service/verification';
import { VerificationCheckInstance } from 'twilio/lib/rest/verify/v2/service/verificationCheck';
import { getSignupHtml } from './configs/signupEmail';
import { SocialConnect, SocialConnectInfo, TokenResponse } from './dtos/dto';
/*
 * TODO: !!!
 */
const transporter = nodemailer.createTransport({
  host: env.smtp_host ? env.smtp_host : 'http://localhost:3334',
  port: env.smtp_port ? env.smtp_port : 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: env.smtp_username ? env.smtp_username : 'username', // generated ethereal user
    pass: env.smtp_password ? env.smtp_password : 'password' // generated ethereal password
  }
});

@Injectable()
export class AppService {
  constructor(
    private authService: AuthenticationService,
    private fbClient: FacebookClient,
    private download: Downloader,
    private telegramService: TelegramClient,
    private twilioService: TwilioService
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
          avatar: avatar.uri,
          socialToken: social.socialToken
        });
      } else {
        await this.authService.createAccountAuthenId(
          currentAccount,
          social.provider,
          social.socialId,
          social.socialToken
        );
      }
    }

    credential.account.isGuest = false;
    this.logger.log('get AccessTokenPayload FromCredential');
    const accessTokenPayload =
      await this.authService.getAccessTokenPayloadFromCredential(credential);
    this.logger.log('renew Tokens');
    const tokenResult: TokenResponse = await credential.renewTokens(
      accessTokenPayload,
      {
        id: currentAccount._id as unknown as string,
        role: 'member'
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
      !payload.id ||
      !payload.first_name ||
      !payload.last_name ||
      !payload.username ||
      !payload.auth_date ||
      !payload.hash
    ) {
      this.logger.error(`payload data missing.`);
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, language);
    }

    const message: TelegramUserInfo = {
      id: payload.id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      username: payload.username,
      photo_url: payload.photo_url ? payload.photo_url : '',
      auth_date: payload.auth_date,
      hash: payload.hash
    };
    this.logger.log('Validate Hash');
    return await this.telegramService.verifyUserToken(message);
  }

  /**
   * request OTP
   * @param {AccountDocument} account
   * @param {OtpObjective} objective
   * @return {Promise<VerificationInstance>}
   */
  async requestOtp(
    channel: string,
    account: AccountDocument
  ): Promise<VerificationInstance> {
    if (channel === 'email') {
      return await this.twilioService.requestOtp(
        account.email,
        EChannelType.EMAIL
      );
    } else {
      const combileNumber = await MobileNumber.getMobileNumberWithCountyrCode(
        account.mobile.countryCode,
        account.mobile.number
      );
      return await this.twilioService.requestOtp(
        combileNumber,
        EChannelType.MOBILE
      );
    }
  }

  /**
   * verification OTP
   * @param {AccountDocument} account
   * @param {string} objective
   * @return {Promise<VerificationCheckInstance>}
   */
  async verificationOtp(
    channel: string,
    account: AccountDocument,
    otp: string
  ): Promise<VerificationCheckInstance> {
    if (channel === 'email') {
      return await this.twilioService.verifyOtp(account.email, otp);
    } else {
      const combileNumber = await MobileNumber.getMobileNumberWithCountyrCode(
        account.mobile.countryCode,
        account.mobile.number
      );
      return await this.twilioService.verifyOtp(combileNumber, otp);
    }
  }
}
