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

import { CastcleLogger, Token } from '@castcle-api/common';
import { Environment } from '@castcle-api/environments';
import {
  GoogleClient,
  TwilioChannel,
  TwilioClient,
  TwilioErrorMessage,
  TwilioStatus,
} from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { DateTime } from 'luxon';
import {
  ChangePasswordDto,
  RegisterFirebaseDto,
  RequestOtpByEmailDto,
  RequestOtpByMobileDto,
  RequestOtpForChangingPasswordDto,
  VerifyOtpByEmailDto,
  VerifyOtpByMobileDto,
} from '../dtos';
import {
  AccountActivationType,
  OtpObjective,
  OtpTemplateMessage,
  QueueName,
  VerifyEmailMessage,
} from '../models';
import { Repository } from '../repositories';
import { Account } from '../schemas';

@Injectable()
export class AuthenticationServiceV2 {
  private logger = new CastcleLogger(AuthenticationServiceV2.name);

  constructor(
    private googleClient: GoogleClient,
    private twilioClient: TwilioClient,
    private repository: Repository,
    @InjectQueue(QueueName.VERIFY_EMAIL)
    private emailVerifier: Queue<VerifyEmailMessage>,
  ) {}

  /**
   * For check if castcle ID is existed
   * @param {string} castcleId
   * @returns user
   */
  getExistedUserFromCastcleId(castcleId: string) {
    return this.repository.findUser({ _id: castcleId });
  }

  /**
   * For check if email is existed
   * @param {string} email
   * @returns account
   */
  getAccountFromEmail(email: string) {
    return this.repository.findAccount({ email });
  }

  async requestOtpByEmail({
    email,
    objective,
    recaptchaToken,
    requestedBy,
    ip,
    source,
    userAgent,
  }: RequestOtpByEmailDto & {
    ip?: string;
    requestedBy: Account;
    source?: string;
    userAgent?: string;
  }) {
    const recaptchaVerified =
      source?.toLowerCase() === 'web'
        ? await this.googleClient.verifyRecaptcha(recaptchaToken, ip)
        : true;
    if (!recaptchaVerified) new CastcleException('RECAPTCHA_FAILED');

    switch (objective) {
      case OtpObjective.SEND_TOKEN:
        return this.requestSendTokenOtp({
          channel: TwilioChannel.EMAIL,
          email,
          requestedBy,
          userAgent,
        });
      default:
        return this.requestForgotPasswordOtp({
          email,
          objective,
          requestedBy,
          userAgent,
        });
    }
  }

  private async requestForgotPasswordOtp({
    email,
    objective,
    requestedBy,
    userAgent,
  }: RequestOtpByEmailDto & {
    requestedBy: Account;
    userAgent?: string;
  }) {
    if (objective !== OtpObjective.CHANGE_PASSWORD && !requestedBy.isGuest) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }

    const account = await this.repository.findAccount({ email });
    if (!account) throw new CastcleException('EMAIL_NOT_FOUND');
    if (
      objective === OtpObjective.CHANGE_PASSWORD &&
      String(requestedBy._id) !== account.id
    ) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }

    return this.requestOtp({
      channel: TwilioChannel.EMAIL,
      objective,
      receiver: email,
      account,
      requestedBy: requestedBy._id,
      userAgent,
    });
  }

  private async requestSendTokenOtp({
    channel,
    email,
    countryCode,
    mobileNumber,
    requestedBy,
    userAgent,
  }: {
    channel: TwilioChannel;
    email?: string;
    countryCode?: string;
    mobileNumber?: string;
    requestedBy: Account;
    userAgent?: string;
  }) {
    if (requestedBy.isGuest) throw new CastcleException('INVALID_ACCESS_TOKEN');

    const account = await this.repository.findAccount(
      channel === TwilioChannel.EMAIL
        ? { email }
        : { mobileCountryCode: countryCode, mobileNumber },
    );
    if (account?.id !== String(requestedBy._id)) {
      throw new CastcleException(
        channel === TwilioChannel.EMAIL
          ? 'EMAIL_NOT_FOUND'
          : 'MOBILE_NOT_FOUND',
      );
    }

    return this.requestOtp({
      channel,
      objective: OtpObjective.SEND_TOKEN,
      receiver:
        channel === TwilioChannel.EMAIL ? email : countryCode + mobileNumber,
      account,
      requestedBy: requestedBy._id,
      userAgent,
    });
  }

  async requestOtpByMobile({
    countryCode,
    mobileNumber,
    objective,
    recaptchaToken,
    requestedBy,
    ip,
    source,
    userAgent,
  }: RequestOtpByMobileDto & {
    ip?: string;
    requestedBy: Account;
    source?: string;
    userAgent?: string;
  }) {
    const recaptchaVerified =
      source?.toLowerCase() === 'web'
        ? await this.googleClient.verifyRecaptcha(recaptchaToken, ip)
        : true;
    if (!recaptchaVerified) new CastcleException('RECAPTCHA_FAILED');

    switch (objective) {
      case OtpObjective.SEND_TOKEN:
        return this.requestSendTokenOtp({
          channel: TwilioChannel.SMS,
          countryCode,
          mobileNumber,
          requestedBy,
          userAgent,
        });
      default:
        return this.requestVerifyMobileOtp({
          countryCode,
          mobileNumber,
          requestedBy,
          userAgent,
        });
    }
  }

  private async requestVerifyMobileOtp({
    countryCode,
    mobileNumber,
    requestedBy,
    userAgent,
  }: {
    countryCode?: string;
    mobileNumber?: string;
    requestedBy: Account;
    userAgent?: string;
  }) {
    const existingAccount = await this.repository.findAccount({
      mobileCountryCode: countryCode,
      mobileNumber,
    });
    if (existingAccount)
      throw new CastcleException('MOBILE_NUMBER_ALREADY_EXISTS');
    if (requestedBy.isGuest) throw new CastcleException('INVALID_ACCESS_TOKEN');

    return this.requestOtp({
      channel: TwilioChannel.SMS,
      objective: OtpObjective.VERIFY_MOBILE,
      receiver: countryCode + mobileNumber,
      account: requestedBy,
      requestedBy: requestedBy._id,
      userAgent,
    });
  }

  private async requestOtp({
    channel,
    objective,
    receiver,
    account,
    requestedBy,
    userAgent,
  }: {
    channel: TwilioChannel;
    objective: OtpObjective;
    receiver: string;
    account: Account;
    requestedBy: string;
    userAgent?: string;
  }) {
    try {
      const otp = await this.repository.findOtp({
        channel,
        objective,
        receiver,
      });

      if (otp?.exceededUsageLimit()) {
        throw new CastcleException('OTP_USAGE_LIMIT_EXCEEDED');
      }
      if (otp?.isValid() && otp.exceededMaxRetries()) {
        throw new CastcleException('TWILIO_TOO_MANY_REQUESTS');
      }
      if (otp?.isValid() && !otp.isVerify) {
        return otp;
      }

      const user = await this.repository.findUser({ accountId: account._id });
      const { sid } = await this.twilioClient.requestOtp({
        channel,
        accountId: account.id,
        userAgent,
        receiver,
        config: OtpTemplateMessage.from(objective, user?.displayName),
      });

      return otp
        ? otp
            .regenerate()
            .set({
              isVerify: false,
              sid,
              requestId: requestedBy,
              retry: 0,
              sentAt: [...otp.sentAt, new Date()],
            })
            .save()
        : this.repository.createOtp({
            channel,
            accountId: account._id,
            objective,
            requestId: requestedBy,
            verified: false,
            receiver,
            sid,
          });
    } catch (error) {
      this.logger.error(error, 'requestOtp');
      if (error.message === TwilioErrorMessage.TOO_MANY_REQUESTS) {
        throw new CastcleException('TWILIO_TOO_MANY_REQUESTS');
      } else if (error instanceof CastcleException) {
        throw error;
      } else {
        throw new CastcleException('TWILIO_MAX_LIMIT');
      }
    }
  }

  async verifyOtpByEmail({
    objective,
    email,
    refCode,
    otp: otpCode,
    requestedBy,
    guestAccessToken,
  }: VerifyOtpByEmailDto & { requestedBy: Account; guestAccessToken: string }) {
    if (objective !== OtpObjective.CHANGE_PASSWORD && !requestedBy.isGuest) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }

    const account = await this.repository.findAccount({ email });
    if (!account) throw new CastcleException('EMAIL_NOT_FOUND');
    if (
      objective === OtpObjective.CHANGE_PASSWORD &&
      String(requestedBy._id) !== account.id
    ) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }

    const otp = await this.verifyOtp({
      channel: TwilioChannel.EMAIL,
      objective,
      receiver: email,
      refCode,
      otp: otpCode,
    });

    if (objective !== OtpObjective.MERGE_ACCOUNT) return { otp };

    const credential = requestedBy.credentials.find(
      (c) => c.accessToken === guestAccessToken,
    );
    const [{ accessToken }] = await Promise.all([
      account.generateToken(credential),
      requestedBy.remove(),
    ]);

    return { otp, accessToken };
  }

  async verifyOtpByMobile({
    objective,
    countryCode,
    mobileNumber,
    refCode,
    otp: otpCode,
    requestedBy,
  }: VerifyOtpByMobileDto & { requestedBy: Account }) {
    const existingAccount = await this.repository.findAccount({
      mobileCountryCode: countryCode,
      mobileNumber,
    });
    if (existingAccount)
      throw new CastcleException('MOBILE_NUMBER_ALREADY_EXISTS');
    if (requestedBy.isGuest) throw new CastcleException('INVALID_ACCESS_TOKEN');

    return this.verifyOtp({
      channel: TwilioChannel.SMS,
      objective,
      receiver: countryCode + mobileNumber,
      refCode,
      otp: otpCode,
    });
  }

  async verifyOtp({
    channel,
    objective,
    receiver,
    refCode,
    otp,
  }: {
    channel: TwilioChannel;
    objective: OtpObjective;
    receiver: string;
    refCode: string;
    otp: string;
  }) {
    const isEmailOtp = channel === TwilioChannel.EMAIL;
    const existingOtp = await this.repository.findOtp({
      channel,
      objective,
      receiver,
      verified: false,
    });

    if (!existingOtp) {
      throw new CastcleException(
        isEmailOtp ? 'INVALID_EMAIL_OTP' : 'INVALID_SMS_OTP',
      );
    }
    if (existingOtp.refCode !== refCode) {
      throw new CastcleException(
        isEmailOtp ? 'INVALID_EMAIL_REF_CODE' : 'INVALID_SMS_REF_CODE',
      );
    }
    if (!existingOtp.isValid()) {
      throw new CastcleException(
        isEmailOtp ? 'EXPIRED_EMAIL_OTP' : 'EXPIRED_SMS_OTP',
      );
    }
    if (existingOtp.exceededMaxRetries()) {
      await this.twilioClient.cancelOtp(existingOtp.sid);
      throw new CastcleException(
        isEmailOtp ? 'LOCKED_EMAIL_OTP' : 'LOCKED_SMS_OTP',
      );
    }

    try {
      const otpVerification = await this.twilioClient.verifyOtp(receiver, otp);
      if (otpVerification.status !== TwilioStatus.APPROVED) {
        await existingOtp.updateOne({ $inc: { retry: 1 } });
        throw new CastcleException(
          isEmailOtp ? 'INVALID_EMAIL_OTP' : 'INVALID_SMS_OTP',
        );
      }
      return existingOtp.markVerified().save();
    } catch (error) {
      this.logger.error(error, `verifyOtp:${channel}`);
      if (error instanceof CastcleException) throw error;
      await this.twilioClient.cancelOtp(existingOtp.sid);
      throw new CastcleException(
        isEmailOtp ? 'EXPIRED_EMAIL_OTP' : 'EXPIRED_SMS_OTP',
      );
    }
  }

  async requestOtpForChangingPassword({
    email,
    password,
    objective,
    requestedBy,
  }: RequestOtpForChangingPasswordDto & { requestedBy: Account }) {
    const account = await this.repository.findAccount({ email });
    if (!account) throw new CastcleException('EMAIL_NOT_FOUND');
    if (account.id !== requestedBy.id) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }
    if (!account.verifyPassword(password)) {
      throw new CastcleException('INVALID_PASSWORD');
    }

    const otp = await this.repository.findOtp({
      channel: TwilioChannel.EMAIL,
      objective,
      receiver: email,
      verified: true,
    });

    if (!otp) {
      return this.repository.createOtp({
        channel: TwilioChannel.EMAIL,
        accountId: account.id,
        objective,
        requestId: requestedBy._id,
        verified: true,
        receiver: email,
      });
    }

    if (otp.exceededUsageLimit()) {
      throw new CastcleException('OTP_USAGE_LIMIT_EXCEEDED');
    }
    if (otp.isValid() && otp.exceededMaxRetries()) {
      throw new CastcleException('TWILIO_MAX_LIMIT');
    }
    if (otp.isValid() && !otp.exceededMaxRetries()) {
      return otp;
    }

    return otp
      .regenerate()
      .set({
        requestId: requestedBy,
        retry: 0,
        sentAt: [...otp.sentAt, new Date()],
      })
      .save();
  }

  async changePassword({
    objective,
    refCode,
    email,
    newPassword,
    requestedBy,
  }: ChangePasswordDto & { requestedBy: Account }) {
    const account = await this.repository.findAccount({ email });

    if (objective === OtpObjective.FORGOT_PASSWORD && !requestedBy.isGuest) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }
    if (
      objective === OtpObjective.CHANGE_PASSWORD &&
      String(requestedBy._id) !== account?.id
    ) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }

    const otp = await this.repository.findOtp({
      channel: TwilioChannel.EMAIL,
      objective,
      receiver: email,
    });

    if (!otp?.isVerify) {
      throw new CastcleException('INVALID_REF_CODE');
    }
    if (!otp.isValid()) {
      await otp.updateOne({ isVerify: false, retry: 0 });
      throw new CastcleException('EXPIRED_OTP');
    }
    if (otp.refCode !== refCode) {
      await otp.failedToVerify().save();
      throw otp.exceededMaxRetries()
        ? new CastcleException('OTP_USAGE_LIMIT_EXCEEDED')
        : new CastcleException('INVALID_REF_CODE');
    }

    await account.changePassword(newPassword);
    await otp.markCompleted().save();
  }

  async requestVerificationLink(account: Account, hostUrl: string) {
    const activation = account.activations?.find(
      ({ type }) => type === AccountActivationType.EMAIL,
    );

    if (!activation) throw new CastcleException('INVALID_ACCESS_TOKEN');
    if (activation.activationDate) {
      throw new CastcleException('EMAIL_ALREADY_VERIFIED');
    }

    const tokenExpiryDate = DateTime.local().plus({
      seconds: Environment.JWT_VERIFY_EXPIRES_IN,
    });
    const tokenPayload = {
      id: account.id,
      expiryDate: tokenExpiryDate.toString(),
    };

    activation.revocationDate = new Date();
    activation.verifyTokenExpireDate = tokenExpiryDate.toJSDate();
    activation.verifyToken = Token.generateToken(
      tokenPayload,
      Environment.JWT_VERIFY_SECRET,
      Environment.JWT_VERIFY_EXPIRES_IN,
    );

    account.markModified('activations');
    await account.save();

    await this.emailVerifier.add(
      {
        hostUrl: hostUrl,
        toEmail: account.email,
        accountId: account.id,
      },
      { removeOnComplete: true },
    );
  }

  async verifyEmail(activationToken: string) {
    const account = await this.repository.findAccount({ activationToken });
    const now = new Date();
    const activation = account?.activations?.find(
      (activation) =>
        activation.type === AccountActivationType.EMAIL &&
        activation.verifyToken === activationToken &&
        activation.verifyTokenExpireDate > now &&
        !activation.activationDate,
    );

    if (!activation) throw new CastcleException('INVALID_REFRESH_TOKEN');

    activation.activationDate = now;
    account.activateDate = now;
    account.isGuest = false;
    account.markModified('activations');

    return Promise.all([
      account.save(),
      this.repository.updateUser(
        { accountId: account._id },
        { 'verified.email': true },
      ),
    ]);
  }

  async createAccountDevice(
    { firebaseToken, platform, uuid }: RegisterFirebaseDto,
    account: Account,
  ) {
    const device = account.devices?.find(
      (device) => uuid === device.uuid && platform === device.platform,
    );

    if (device) device.firebaseToken = firebaseToken;
    else (account.devices ||= []).push({ uuid, platform, firebaseToken });

    account.markModified('devices');
    await account.save();
  }

  async deleteAccountDevice(body: RegisterFirebaseDto, account: Account) {
    await this.repository.updateAccount(
      {
        _id: account._id,
        uuid: body.uuid,
        platform: body.platform,
      },
      {
        $pull: {
          devices: {
            uuid: body.uuid,
            platform: body.platform,
            firebaseToken: body.firebaseToken,
          },
        },
      },
    );
  }

  async suggestCastcleId(castcleId: string) {
    return this.repository.suggestCastcleId(castcleId);
  }
}
