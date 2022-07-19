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
  Account,
  AuthenticationService,
  Credential,
  DEFAULT_QUERY_OPTIONS,
  Otp,
  OtpObjective,
  OtpTemplateMessage,
  SocialConnectDto,
  UserService,
  getSocialPrefix,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { AVATAR_SIZE_CONFIGS, Downloader, Image } from '@castcle-api/utils/aws';
import { TwilioChannel, TwilioClient } from '@castcle-api/utils/clients';
import { Password } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { VerificationCheckInstance } from 'twilio/lib/rest/verify/v2/service/verificationCheck';
import { getSignupHtml } from './configs/signupEmail';
import {
  ChangePasswordBody,
  RequestOtpDto,
  TokenResponse,
  VerificationOtpDto,
} from './dtos';

@Injectable()
export class AppService {
  constructor(
    private authService: AuthenticationService,
    private download: Downloader,
    private userService: UserService,
    private twilioClient: TwilioClient,
    private httpService: HttpService,
  ) {}

  private logger = new CastLogger(AppService.name);
  private transporter = createTransport({
    host: Environment.SMTP_HOST,
    port: Environment.SMTP_PORT,
    secure: true,
    auth: {
      user: Environment.SMTP_USERNAME,
      pass: Environment.SMTP_PASSWORD,
    },
  });

  async sendRegistrationEmail(hostUrl: string, toEmail: string, code: string) {
    const verifyLink = `${hostUrl}/authentications/verify`;
    const info = await this.transporter.sendMail({
      from: 'castcle-noreply" <no-reply@castcle.com>',
      subject: 'Welcome to Castcle',
      to: toEmail,
      text: `Welcome to castcle here is a link embed code ${verifyLink}?code=${code}`,
      html: getSignupHtml(
        toEmail,
        `${verifyLink}?code=${code}`,
        Environment.SMTP_ADMIN_EMAIL || 'admin@castcle.com',
      ),
    });

    this.logger.log(`Email is send ${info.messageId} ${info}`);
  }

  /**
   * Validate if password pass Password.validate() if not will throw CastcleException
   * @param password
   * @param languages en is default
   * @returns {boolean}
   */
  validatePassword(password: string) {
    if (Password.validate(password)) return true;
    else {
      throw new CastcleException('INVALID_PASSWORD');
    }
  }

  /**
   * Create user and generate token for login social
   */
  async socialLogin(
    body: SocialConnectDto,
    req: CredentialRequest,
    { ip }: { ip?: string } = {},
  ) {
    this.logger.log('get AccountAuthenIdFromSocialId');
    const socialAccount = await this.authService.getAccountAuthenIdFromSocialId(
      body.socialId,
      body.provider,
    );

    if (socialAccount) {
      this.logger.log('Existing Social Account');
      const account = await this.authService.getAccountFromId(
        socialAccount.account._id,
      );

      this.logger.log('get All User');
      req.$credential.account = account;
      const users = await this.getUserProfile(req.$credential);

      this.logger.log('renew Tokens');
      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(
          req.$credential,
        );
      const token: TokenResponse = await req.$credential.renewTokens(
        accessTokenPayload,
        {
          id: account.id as any,
        },
      );
      return { token, users, account, isNewUser: false };
    } else {
      if (body.email) {
        this.logger.log('get account from email.');
        const account = await this.authService.getAccountFromEmail(body.email);
        if (account) {
          this.logger.log('Existing Email Account');
          req.$credential.account = account;
          const users = await this.getUserProfile(req.$credential);
          return { token: null, users: users, account: account };
        }
      }

      this.logger.log('Register new social account');
      const account = await this.authService.getAccountFromCredential(
        req.$credential,
      );

      if (!account) throw new CastcleException('INVALID_ACCESS_TOKEN');

      let avatar: Image;
      if (body.avatar) {
        this.logger.log(`download avatar from ${body.provider}`);
        const img = await this.download.getImageFromUrl(body.avatar);

        this.logger.log('upload avatar to s3');
        avatar = await Image.upload(img, {
          filename: `avatar-${req.$credential.account._id}`,
          addTime: true,
          sizes: AVATAR_SIZE_CONFIGS,
          subpath: `account_${req.$credential.account._id}`,
        });
      }

      this.logger.log(`Update Email to Account : ${body.email}`);
      account.email = body.email ? body.email : account.email;
      this.logger.log(`signup by Social : ${body.provider}`);
      await this.authService.signupBySocial(account, {
        displayName: body.displayName
          ? body.displayName
          : getSocialPrefix(body.socialId, body.provider),
        socialId: body.socialId,
        provider: body.provider,
        avatar: avatar ? avatar.image : undefined,
        socialToken: body.authToken ? body.authToken : undefined,
        socialSecretToken: undefined,
        referral: body.referral,
        ip,
      });

      if (body.email) {
        const accountActivation =
          await this.authService.createAccountActivation(account, 'email');

        if (accountActivation && accountActivation.isVerifyTokenValid()) {
          this.logger.log(`activate user account, email : ${body.email}`);
          await this.authService.verifyAccount(accountActivation);
        }
      }

      this.logger.log('get All User');
      const users = await this.getUserProfile(req.$credential);

      this.logger.log('renew Tokens');
      req.$credential.account.isGuest = false;
      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(
          req.$credential,
        );
      const token: TokenResponse = await req.$credential.renewTokens(
        accessTokenPayload,
        { id: account.id as any },
      );

      return { token, users, account, isNewUser: true };
    }
  }

  /**User Profile and Pages
   * @param {Credential} credential
   * @returns {profile,pages} profile data
   */
  async getUserProfile(credential: Credential) {
    const user = await this.userService.getUserFromCredential(credential);
    const pages = user
      ? await this.userService.getUserPages(user, {
          limit: 1000,
          page: DEFAULT_QUERY_OPTIONS.page,
          sortBy: DEFAULT_QUERY_OPTIONS.sortBy,
        })
      : null;

    return {
      profile: user,
      pages: pages,
    };
  }

  /**
   * get and validate account from email
   * @param {string} email
   * @param {string} lang
   * @returns account document
   */
  async getAccountFromEmail(email: string) {
    this.logger.log('Get Account from email');
    const account = await this.authService.getAccountFromEmail(email);
    if (!account) throw new CastcleException('EMAIL_OR_PHONE_NOT_FOUND');

    return account;
  }

  private async validateExistingOtp(
    objective: OtpObjective,
    credential: CredentialRequest,
    channel: string,
    receiver: string,
  ) {
    const allExistingOtp =
      await this.authService.getAllOtpFromRequestIdObjective(
        credential.$credential.account._id,
      );

    let existingOtp = null;
    for (const { exOtp } of allExistingOtp.map((exOtp) => ({ exOtp }))) {
      if (
        exOtp.isValid() &&
        exOtp.channel === channel &&
        exOtp.action === objective &&
        exOtp.receiver === receiver
      ) {
        existingOtp = exOtp;
      } else {
        // disable cancel
        // await this.cancelOtp(exOtp);
        // this.logger.log('Delete OTP refCode: ' + exOtp.refCode);
        // await exOtp.delete();
      }
    }

    return existingOtp;
  }

  private async getAccount(
    mobileNumber: string,
    countryCode: string,
    objective: OtpObjective,
    credential: CredentialRequest,
  ) {
    this.logger.log('Get Account from mobile');
    let account = await this.authService.getAccountFromMobile(
      mobileNumber,
      countryCode,
    );

    if (!account && objective !== OtpObjective.VERIFY_MOBILE) {
      this.logger.error(
        'Can not get Account from mobile : ' + countryCode + mobileNumber,
      );
      throw new CastcleException('EMAIL_OR_PHONE_NOT_FOUND');
    }

    if (account && objective === OtpObjective.VERIFY_MOBILE) {
      this.logger.error('Duplicate mobile : ' + countryCode + mobileNumber);
      throw new CastcleException('MOBILE_NUMBER_ALREADY_EXISTS');
    }

    if (!account && objective === OtpObjective.VERIFY_MOBILE) {
      account = await this.authService.getAccountFromCredential(
        credential.$credential,
      );

      if (account.isGuest) {
        this.logger.error('Can not verify mobile from guest account');
        throw new CastcleException('FORBIDDEN');
      }
    }

    return account;
  }

  /**
   * forgot password request Otp
   * @param {RequestOtpDto} request
   * @param {CredentialRequest} credential
   * @param {string} ip
   * @param {string} userAgent
   * @returns {Otp} Opt data
   */
  async requestOtpCode(
    request: RequestOtpDto,
    credential: CredentialRequest,
    ip: string,
    userAgent: string,
    source: string,
  ) {
    let account: Account = null;
    let otp: Otp = null;
    const objective = request.objective;
    // recaptchaToken mobile and on web only
    if (source.toLowerCase() == 'web' && request.channel == 'mobile') {
      if (request.payload.recapchaToken) {
        const token = request.payload.recapchaToken;
        const url = `https://www.google.com/recaptcha/api/siteverify?secret=${Environment.RECAPTCHA_SITE_KEY}&response=${token}&remoteip=${ip}`;
        this.logger.log(`[requestOtpCode] url: ${url}`);
        const captchaResponse = await lastValueFrom(
          this.httpService.post(url).pipe(map(({ data }) => data)),
        );
        this.logger.log(
          `[requestOtpCode] captchaResponse: ${JSON.stringify(
            captchaResponse,
          )}`,
        );
        if (captchaResponse && captchaResponse.success == false) {
          throw new CastcleException('RECAPTCHA_FAILED');
        }
      } else {
        //throw error
        throw new CastcleException('RECAPTCHA_FAILED');
      }
    }

    switch (request.channel) {
      case 'email': {
        const exOtp = await this.validateExistingOtp(
          objective,
          credential,
          request.channel,
          request.payload.email,
        );
        if (exOtp) {
          this.logger.log('Already has Otp. ref code : ' + exOtp.refCode);
          return exOtp;
        }

        account = await this.getAccountFromEmail(request.payload.email);

        this.logger.log('Create Otp');
        otp = await this.generateAndSendOtp(
          ip,
          userAgent,
          request.payload.countryCode,
          request.payload.email,
          account,
          TwilioChannel.EMAIL,
          objective,
          credential,
        );
        break;
      }
      case 'mobile': {
        const exOtp = await this.validateExistingOtp(
          objective,
          credential,
          request.channel,
          request.payload.countryCode + request.payload.mobileNumber,
        );
        if (exOtp) {
          this.logger.log('Already has Otp. ref code : ' + exOtp.refCode);
          return exOtp;
        }

        account = await this.getAccount(
          request.payload.mobileNumber,
          request.payload.countryCode,
          objective,
          credential,
        );

        this.logger.log('Create OTP');
        otp = await this.generateAndSendOtp(
          ip,
          userAgent,
          request.payload.countryCode,
          request.payload.countryCode + request.payload.mobileNumber,
          account,
          TwilioChannel.SMS,
          objective,
          credential,
        );
        break;
      }
      default: {
        this.logger.error(`Forgot password channel mismatch.`);
        throw new CastcleException('PAYLOAD_CHANNEL_MISMATCH');
      }
    }
    return otp;
  }

  /**
   * generate and send Otp
   * @param {string} receiver
   * @param {Account} account
   * @param {TwilioChannel} account
   * @returns {Otp} Opt data
   */
  async generateAndSendOtp(
    ip: string,
    userAgent: string,
    countryCode: string,
    receiver: string,
    account: Account,
    channel: TwilioChannel,
    objective: OtpObjective,
    credential: CredentialRequest,
  ): Promise<Otp> {
    let sid = '';
    this.logger.log('Send Otp');
    try {
      this.logger.log('get user from account');
      const user = await this.authService.getUserFromAccount(account);
      const result = await this.twilioClient.requestOtp({
        ip,
        userAgent,
        countryCode,
        receiver,
        channel,
        config: OtpTemplateMessage.from(objective, user?.displayName),
        accountId: account.id,
      });
      sid = result.sid;
    } catch (ex) {
      this.logger.error('Twilio Error : ' + ex.message, ex);
      if (ex.message == 'Error: Too many requests') {
        throw new CastcleException('TWILIO_TOO_MANY_REQUESTS');
      } else {
        throw new CastcleException('TWILIO_MAX_LIMIT');
      }
    }

    this.logger.log('Generate Ref Code');
    const otp = await this.authService.generateOtp(
      account,
      objective,
      credential.$credential.account._id,
      channel,
      false,
      receiver,
      sid,
    );
    return otp;
  }

  /**
   * forgot password verify Otp
   * @param {VerificationOtpDto} request
   * @param {CredentialRequest} credential
   * @returns {Otp} Opt data
   */
  async verificationOTP(
    request: VerificationOtpDto,
    credential: CredentialRequest,
  ) {
    const limitRetry = 3;
    let account: Account = null;
    let receiver = '';
    const objective = request.objective;

    switch (request.channel) {
      case 'email': {
        account = await this.getAccountFromEmail(request.payload.email);
        receiver = request.payload.email;
        break;
      }
      case 'mobile': {
        account = await this.getAccount(
          request.payload.mobileNumber,
          request.payload.countryCode,
          objective,
          credential,
        );
        receiver = request.payload.countryCode + request.payload.mobileNumber;

        break;
      }
      default: {
        this.logger.error(`Verify password channel mismatch.`);
        throw new CastcleException('PAYLOAD_CHANNEL_MISMATCH');
      }
    }

    this.logger.log('Get Account from OTP');
    const otp = await this.authService.getOtpFromRequestIdRefCode(
      credential.$credential.account._id,
      request.refCode,
    );

    if (!otp) {
      this.logger.error(`Invalid ref code: ${request.refCode}`);
      throw new CastcleException('INVALID_REF_CODE');
    } else if (otp.action !== objective) {
      this.logger.error(`Invalid objective.`);
      throw new CastcleException('PAYLOAD_TYPE_MISMATCH');
    } else if (otp.channel !== request.channel) {
      this.logger.error(`Verify password channel mismatch.`);
      throw new CastcleException('PAYLOAD_CHANNEL_MISMATCH');
    }

    const retryCount = otp.retry ? otp.retry : 0;
    if (retryCount >= limitRetry) {
      this.logger.error(`Otp over limit retry : ${limitRetry}`);
      await this.cancelOtp(otp);
      await otp.delete();
      throw new CastcleException('LOCKED_OTP');
    }

    if (otp && otp.isValid()) {
      this.logger.log('Verify otp with twilio');
      let verifyOtpResult: VerificationCheckInstance;
      try {
        verifyOtpResult = await this.twilioClient.verifyOtp(
          receiver,
          request.otp,
        );
      } catch (ex) {
        this.logger.error(ex.message, ex);
        await this.cancelOtp(otp);
        await otp.delete();
        throw new CastcleException('EXPIRED_OTP');
      }

      this.logger.log('Twilio result : ' + verifyOtpResult.status);
      if (!verifyOtpResult || verifyOtpResult.status !== 'approved') {
        await this.authService.updateRetryOtp(otp);
        this.logger.error(`Invalid Otp.`);
        throw new CastcleException('INVALID_OTP');
      }

      const tokenResult = await this.getTokenMergeAccount(
        objective,
        credential.$credential,
        account,
      );

      this.logger.log('delete old otp');
      await otp.delete();

      this.logger.log('generate new otp with verify pass');
      const newOtp = await this.authService.generateOtp(
        account,
        objective,
        credential.$credential.account._id,
        request.channel === TwilioChannel.EMAIL
          ? TwilioChannel.EMAIL
          : TwilioChannel.SMS,
        true,
        receiver,
      );
      return { otp: newOtp, token: tokenResult };
    } else {
      this.logger.error(`Otp expired.`);
      // await this.cancelOtp(otp);
      this.logger.log('Delete OTP refCode: ' + otp.refCode);
      await otp.delete();
      throw new CastcleException('EXPIRED_OTP');
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
      data.refCode,
    );

    if (
      otp &&
      otp.isValid() &&
      (otp.action === OtpObjective.CHANGE_PASSWORD ||
        otp.action === OtpObjective.FORGOT_PASSWORD) &&
      otp.isVerify
    ) {
      this.logger.log('Validate password');
      this.validatePassword(data.newPassword);
      this.logger.log('Get Account');
      const account = await this.authService.getAccountFromId(otp.account._id);
      this.logger.log('Change password');
      await this.authService.changePassword(account, otp, data.newPassword);
      return '';
    } else {
      this.logger.error(`Invalid Ref Code`);
      throw new CastcleException('INVALID_REF_CODE');
    }
  }

  private async cancelOtp(otp: Otp) {
    this.logger.log('Cancel Twilio Otp.');
    try {
      if (otp.sid) await this.twilioClient.cancelOtp(otp.sid);
    } catch (ex) {
      this.logger.warn('Can not cancel otp:', ex);
    }
  }

  private async getTokenMergeAccount(
    objective: OtpObjective,
    credential: Credential,
    account: Account,
  ) {
    if (objective === OtpObjective.MERGE_ACCOUNT) {
      credential = await this.authService.linkCredentialToAccount(
        credential,
        account,
      );

      this.logger.log('renew Tokens for merge account.');
      credential.account.isGuest = false;
      const accessTokenPayload =
        await this.authService.getAccessTokenPayloadFromCredential(credential);
      return await credential.renewTokens(accessTokenPayload, {
        id: account.id as any,
      });
    } else {
      return undefined;
    }
  }
}
