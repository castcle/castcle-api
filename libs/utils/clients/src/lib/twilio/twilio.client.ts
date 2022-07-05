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
import { CastLogger } from '@castcle-api/logger';
import { Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';
import { TwilioChannel, TwilioStatus } from './twilio.enum';

@Injectable()
export class TwilioClient {
  private logger = new CastLogger(TwilioClient.name);
  private client = new Twilio(
    Environment.TWILIO_ACCOUNT_SID,
    Environment.TWILIO_AUTH_TOKEN,
  );

  getRateLimitsOTP(dto: {
    userAgent: string;
    channel: TwilioChannel;
    accountId: string;
    ip?: string;
    receiver?: string;
    countryCode?: string;
  }) {
    if (dto.channel !== TwilioChannel.SMS) {
      return {
        session_id: dto.accountId,
        user_agent: dto.userAgent,
      };
    }

    const countries = Environment.TWILIO_COUNTRY_CODES;
    const countryCodeIncluded = countries.includes(dto.countryCode);

    if (!countryCodeIncluded) {
      return {
        end_user_ip_address: dto.ip,
        phone_number: dto.receiver,
        phone_number_country_code: dto.countryCode,
        session_id: dto.accountId,
        user_agent: dto.userAgent,
      };
    }

    return {
      phone_number: dto.receiver,
      session_id: dto.accountId,
      user_agent: dto.userAgent,
    };
  }

  async requestOtp(dto: {
    channel: TwilioChannel;
    accountId: string;
    receiver: string;
    userAgent: string;
    config: any;
    ip?: string;
    countryCode?: string;
  }) {
    const rateLimits = this.getRateLimitsOTP(dto);
    this.logger.log(
      `Request OTP DTO: ${JSON.stringify({
        receiver: dto.receiver,
        channel: dto.channel,
        rateLimits,
      })}`,
      'requestOtp:start',
    );
    return this.client.verify
      .services(Environment.TWILIO_OTP_SID)
      .verifications.create({
        rateLimits: rateLimits,
        channelConfiguration: { substitutions: dto.config },
        to: dto.receiver,
        channel: dto.channel,
      })
      .then((verification) => {
        this.logger.log(
          `${dto.accountId} invoke Twilio Verification SID: ${verification.sid}`,
          'requestOtp:success',
        );
        return verification;
      })
      .catch((error) => {
        this.logger.error(error, 'requestOtp:error');
        throw new Error(error);
      });
  }

  async verifyOtp(receiver: string, otp: string) {
    this.logger.log(`Verify otp receiver: ${receiver}`);
    return this.client.verify
      .services(Environment.TWILIO_OTP_SID)
      .verificationChecks.create({ to: receiver, code: otp })
      .then((verification) => {
        return verification;
      })
      .catch((error) => {
        throw new Error(error);
      });
  }

  async cancelOtp(sid: string) {
    this.logger.log(`Cancel otp sid: ${sid}`, 'cancelOtp');
    return this.client.verify
      .services(Environment.TWILIO_OTP_SID)
      .verifications(sid)
      .update({ status: TwilioStatus.CANCELED })
      .then(() => true)
      .catch((error) => {
        this.logger.log(error, 'cancelOtp');
        return false;
      });
  }
}
