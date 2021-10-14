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

import { Environment } from '@castcle-api/environments';
import { Injectable } from '@nestjs/common';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import * as Twilio from 'twilio';
import { VerificationInstance } from 'twilio/lib/rest/verify/v2/service/verification';
import { VerificationCheckInstance } from 'twilio/lib/rest/verify/v2/service/verificationCheck';

const env = {
  twilioAccountSid: Environment.twilio_account_sid,
  twilioAuthToken: Environment.twilio_auth_token,
  twilioOtpSid: Environment.twilio_otp_sid
};

export enum EChannelType {
  EMAIL = 'email',
  MOBILE = 'sms'
}

export enum EOtpStatus {
  PENDING = 'pending',
  APPROVED = 'approved'
}

@Injectable()
export class TwilioService {
  private readonly logger = new CastLogger(
    TwilioService.name,
    CastLoggerOptions
  );

  private readonly twilioAccountSid: string = Environment.twilio_account_sid;
  private readonly twilioAuthToken: string = Environment.twilio_auth_token;
  private readonly twilioOtpSid: string = Environment.twilio_otp_sid;

  /**
   * Request OTP
   * @param {string} receiver
   * @param {EChannelType} channel
   * @returns {Promise<VerificationInstance>}
   */
  async requestOtp(
    receiver: string,
    channel: EChannelType
  ): Promise<VerificationInstance> {
    const client = Twilio(this.twilioAccountSid, this.twilioAuthToken);
    try {
      const verification = await client.verify
        .services(this.twilioOtpSid)
        .verifications.create({
          to: receiver,
          channel: channel
        });
      console.log(verification);
      return verification;
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * Verify OTP
   * @param {string} receiver
   * @param {string} otp
   * @returns {Promise<VerificationCheckInstance>}
   */
  async verifyOtp(
    receiver: string,
    otp: string
  ): Promise<VerificationCheckInstance> {
    const client = Twilio(this.twilioAccountSid, this.twilioAuthToken);
    try {
      const verification = await client.verify
        .services(this.twilioOtpSid)
        .verificationChecks.create({ to: receiver, code: otp });
      console.log(verification);
      return verification;
    } catch (error) {
      throw new Error(error);
    }
  }
}
