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
import * as Twilio from 'twilio';
import { TwilioChannel } from './twilio.message';

@Injectable()
export class TwilioClient {
  private logger = new CastLogger(TwilioClient.name);
  private client = new Twilio.Twilio(
    Environment.TWILIO_ACCOUNT_SID,
    Environment.TWILIO_AUTH_TOKEN,
  );

  async getRateLimitsOTP(
    ip: string,
    userAgent: string,
    countryCode: string,
    receiver: string,
    channel: TwilioChannel,
    account_id: string,
  ) {
    if (channel == TwilioChannel.Email) {
      return {
        session_id: account_id,
        user_agent: userAgent,
      };
    } else if (channel == TwilioChannel.Mobile) {
      const countries = Environment.TWILIO_COUNTRY_CODE.split(',');
      const indexOfCountry = countries.indexOf(countryCode);
      if (indexOfCountry != -1) {
        return {
          end_user_ip_address: ip,
          phone_number: receiver,
          phone_number_country_code: countryCode,
          session_id: account_id,
          user_agent: userAgent,
        };
      } else {
        return {
          phone_number: receiver,
          session_id: account_id,
          user_agent: userAgent,
        };
      }
    } else {
      return {
        session_id: account_id,
        user_agent: userAgent,
      };
    }
  }

  async requestOtp(
    ip: string,
    userAgent: string,
    countryCode: string,
    receiver: string,
    channel: TwilioChannel,
    config: any,
    account_id: string,
  ) {
    const rateLimits = await this.getRateLimitsOTP(
      ip,
      userAgent,
      countryCode,
      receiver,
      channel,
      account_id,
    );
    this.logger.log(`* [START] requestOtp *`);
    this.logger.log(`Request otp receiver: ${receiver} channel: ${channel}`);
    this.logger.log(`* [PROCESS] requestOtp: ${JSON.stringify(rateLimits)} *`);
    return this.client.verify
      .services(Environment.TWILIO_OTP_SID)
      .verifications.create({
        rateLimits: rateLimits,
        channelConfiguration: {
          substitutions: config,
        },
        to: receiver,
        channel: channel,
      })
      .then((verification) => {
        this.logger.log(`* [SUCCESS] requestOtp *`);
        this.logger.log(
          `${account_id} invoke Twilio Verification SID: ${verification.sid}`,
        );
        return verification;
      })
      .catch((error) => {
        this.logger.log(`* [ERROR] requestOtp: ${error} *`);
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

  async canceledOtp(sid: string) {
    this.logger.log(`Cancel otp sid: ${sid}`);
    return this.client.verify
      .services(Environment.TWILIO_OTP_SID)
      .verifications(sid)
      .update({ status: 'canceled' })
      .then((verification) => {
        return verification;
      })
      .catch((error) => {
        throw new Error(error);
      });
  }
}
