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
  AccountAuthenIdType,
  AccountDocument,
  CredentialDocument,
  OtpDocument,
  OtpObjective,
  UserDocument
} from '@castcle-api/database/schemas';
import { Environment as env } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { Downloader, Image, UploadOptions } from '@castcle-api/utils/aws';
import { TwillioChannel, TwillioClient } from '@castcle-api/utils/clients';
import { Password } from '@castcle-api/utils/commons';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { VerificationCheckInstance } from 'twilio/lib/rest/verify/v2/service/verificationCheck';
import { getSignupHtml } from './configs/signupEmail';
import {
  ChangePasswordBody,
  RequestOtpDto,
  SocialConnectDto,
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
    private download: Downloader,
    private userService: UserService,
    private twillioClient: TwillioClient
  ) {}

  private logger = new CastLogger(AppService.name);

  _uploadImage = (base64: string, options?: UploadOptions) =>
    Image.upload(base64, options);

  getData(): { message: string } {
    return { message: 'Welcome to authentications!' };
  }

  /**
   * Get ENV and return castcle mobile deep link url
   * @returns {string}
   */
  getCastcleMobileLink = () => {
    if (env && env.NODE_ENV) {
      const links = {
        development: 'castcle-dev://?verify=true',
        test: 'castcle-test://?verify=true',
        staging: 'castcle-stg://?verify=true',
        production: 'castcle://?verify=true'
      };
      return links[env.NODE_ENV]
        ? links[env.NODE_ENV]
        : 'castcle-dev://?verify=true';
    } else return 'castcle-dev://?verify=true';
  };

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
        env && env.SMTP_ADMIN_EMAIL ? env.SMTP_ADMIN_EMAIL : 'admin@castcle.com'
      )
    });
    console.log(`Email is send `, info.messageId, info);
  }

  /**
   * Validate if password pass Password.validate() if not will throw CastcleException
   * @param password
   * @param languages en is default
   * @returns {boolean}
   */
  validatePassword(password: string, languages?: string) {
    if (Password.validate(password)) return true;
    else {
      throw new CastcleException(CastcleStatus.INVALID_PASSWORD, languages);
    }
  }

  /**
   * Create user and generate token for login social
   * @param {SocialConnect} social social response
   * @param {CredentialDocument} credential
   * @returns {TokenResponse}
   */
  async socialLogin(body: SocialConnectDto, credential: CredentialDocument) {
    this.logger.log('get AccountAuthenIdFromSocialId');
    const socialAccount = await this.authService.getAccountAuthenIdFromSocialId(
      body.uid,
      body.provider
    );
    if (socialAccount) {
      this.logger.log('Existing Social Account');
      const account = await this.authService.getAccountFromId(
        socialAccount.account._id
      );

      this.logger.log('get All User');
      credential.account = account;
      const users = await this.getUserProfile(credential);

      this.logger.log('renew Tokens');
      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(credential);
      const tokenResult: TokenResponse = await credential.renewTokens(
        accessTokenPayload,
        {
          id: account.id as any
        }
      );
      return { token: tokenResult, users: users, account: account };
    } else {
      if (body.email) {
        this.logger.log('get account from email.');
        const account = await this.authService.getAccountFromEmail(body.email);
        if (account) {
          this.logger.log('Existing Email Account');
          credential.account = account;
          const users = await this.getUserProfile(credential);
          return { token: null, users: users, account: account };
        }
      }

      this.logger.log('Reister new social account');
      const currentAccount = await this.authService.getAccountFromCredential(
        credential
      );
      let avatar;
      if (body.avatar) {
        this.logger.log(`download avatar from ${body.provider}`);
        const img = await this.download.getImageFromUrl(body.avatar);

        this.logger.log('upload avatar to s3');
        avatar = await this._uploadImage(img, {
          filename: `avatar-${credential.account._id}`
        });
      }

      this.logger.log('Update Email to Account.');
      currentAccount.email = body.email ? body.email : currentAccount.email;
      this.logger.log('signup by Social');
      await this.authService.signupBySocial(currentAccount, {
        displayName: body.displayName
          ? body.displayName
          : this.getSocialProfix(body.uid, body.provider),
        socialId: body.uid,
        provider: body.provider,
        avatar: avatar ? avatar.image.original : null,
        socialToken: body.authToken,
        socialSecretToken: null
      });
      this.logger.log('get All User');
      const users = await this.getUserProfile(credential);

      this.logger.log('renew Tokens');
      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(credential);
      const tokenResult: TokenResponse = await credential.renewTokens(
        accessTokenPayload,
        {
          id: currentAccount.id as any
        }
      );
      return { token: tokenResult, users: users, account: currentAccount };
    }
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

  private async validateExistingOtp(
    objective: OtpObjective,
    credential: CredentialRequest,
    channel: string,
    reciever: string
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
        exOtp.action === objective &&
        exOtp.reciever === reciever
      ) {
        existingOtp = exOtp;
      } else {
        await this.cancelOtp(exOtp);
        this.logger.log('Delete OTP refCode: ' + exOtp.refCode);
        await exOtp.delete();
      }
    }

    return existingOtp;
  }

  private async getAccount(
    mobileNumber: string,
    countryCode: string,
    objective: OtpObjective,
    credential: CredentialRequest
  ) {
    this.logger.log('Get Account from mobile');
    let account = await this.authService.getAccountFromMobile(
      mobileNumber,
      countryCode
    );

    if (!account && objective !== OtpObjective.VerifyMobile) {
      this.logger.error(
        'Can not get Account from mobile : ' + countryCode + mobileNumber
      );
      throw new CastcleException(
        CastcleStatus.EMAIL_OR_PHONE_NOTFOUND,
        credential.$language
      );
    }

    if (account && objective === OtpObjective.VerifyMobile) {
      this.logger.error('Dupplicate mobile : ' + countryCode + mobileNumber);
      throw new CastcleException(
        CastcleStatus.MOBILE_NUMBER_IS_EXIST,
        credential.$language
      );
    }

    if (!account && objective === OtpObjective.VerifyMobile) {
      account = await this.authService.getAccountFromCredential(
        credential.$credential
      );

      if (account.isGuest) {
        this.logger.error('Can not verify mobile from guest account');
        throw new CastcleException(
          CastcleStatus.FORBIDDEN_REQUEST,
          credential.$language
        );
      }
    }

    return account;
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

    switch (request.channel) {
      case 'email': {
        const exOtp = await this.validateExistingOtp(
          objective,
          credential,
          request.channel,
          request.payload.email
        );
        if (exOtp) {
          this.logger.log('Already has Otp. ref code : ' + exOtp.refCode);
          return exOtp;
        }

        account = await this.getAccountFromEmail(
          request.payload.email,
          credential.$language
        );

        this.logger.log('Create Otp');
        otp = await this.generateAndSendOtp(
          request.payload.email,
          account,
          TwillioChannel.Email,
          objective,
          credential,
          request.channel
        );
        break;
      }
      case 'mobile': {
        const exOtp = await this.validateExistingOtp(
          objective,
          credential,
          request.channel,
          request.payload.countryCode + request.payload.mobileNumber
        );
        if (exOtp) {
          this.logger.log('Already has Otp. ref code : ' + exOtp.refCode);
          return exOtp;
        }

        account = await this.getAccount(
          request.payload.mobileNumber,
          request.payload.countryCode,
          objective,
          credential
        );

        this.logger.log('Create OTP');
        otp = await this.generateAndSendOtp(
          request.payload.countryCode + request.payload.mobileNumber,
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
      throw new CastcleException(
        CastcleStatus.TWILLIO_MAX_LIMIT,
        credential.$language
      );
    }

    this.logger.log('Generate Ref Code');
    const otp = await this.authService.generateOtp(
      account,
      objective,
      credential.$credential.account._id,
      otpChannel,
      false,
      reciever,
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
        receiver = request.payload.email;
        break;
      }
      case 'mobile': {
        account = await this.getAccount(
          request.payload.mobileNumber,
          request.payload.countryCode,
          objective,
          credential
        );
        receiver = request.payload.countryCode + request.payload.mobileNumber;

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
      await this.cancelOtp(otp);
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
        await this.cancelOtp(otp);
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
        true,
        receiver
      );
      return newOtp;
    } else {
      this.logger.error(`Otp expired.`);
      await this.cancelOtp(otp);
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

  private async cancelOtp(otp: OtpDocument) {
    this.logger.log('Cancel Twillio Otp.');
    try {
      if (otp.sid) await this.twillioClient.canceledOtp(otp.sid);
    } catch (ex) {
      this.logger.warn('Can not cancel otp:', ex);
    }
  }

  getSocialProfix(socialId: string, provider: AccountAuthenIdType) {
    switch (provider) {
      case AccountAuthenIdType.Facebook: {
        return `FB${socialId}`;
      }
      case AccountAuthenIdType.Twitter: {
        return `TW${socialId}`;
      }
      case AccountAuthenIdType.Google: {
        return `GG${socialId}`;
      }
      case AccountAuthenIdType.Apple: {
        return `AP${socialId}`;
      }
      default: {
        return socialId;
      }
    }
  }
}
