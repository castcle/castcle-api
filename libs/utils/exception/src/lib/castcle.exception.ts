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
import { HttpException } from '@nestjs/common';
import { LocalErrorMessage } from './messages';
import { ErrorMessages } from './messages/default';

interface ErrorStatus {
  statusCode: string;
  code: keyof typeof ErrorMessages;
  message: string;
}

export class CastcleException extends HttpException {
  public error: ErrorStatus;

  constructor(castcleStatus: keyof typeof ErrorMessages, language = 'default') {
    const error: ErrorStatus =
      LocalErrorMessage[language]?.[castcleStatus] ??
      ErrorMessages[castcleStatus];
    super(error, Number(error.statusCode));
    this.error = error;
  }

  getLocalStatus(language: string, code?: keyof typeof ErrorMessages) {
    return (
      LocalErrorMessage[language]?.[code || this.error.code] ||
      LocalErrorMessage.default[code || this.error.code]
    );
  }

  static REQUEST_URL_NOT_FOUND = new CastcleException('1001');
  static MISSING_AUTHORIZATION_HEADERS = new CastcleException('1002');
  static INVALID_ACCESS_TOKEN = new CastcleException('1003');
  static INVALID_REFRESH_TOKEN = new CastcleException('1004');
  static INVALID_FORMAT = new CastcleException('1005');
  static UPLOAD_FAILED = new CastcleException('1006');
  static FORBIDDEN = new CastcleException('1007');
  static INVALID_MAX_RESULT = new CastcleException('1008');
  static RATE_LIMIT_REQUEST = new CastcleException('1010');
  static RECAPTCHA_FAILED = new CastcleException('1011');
  static UNABLE_TO_SYNC = new CastcleException('1012');
  static INVALID_AUTH_TOKEN = new CastcleException('3001');
  static INVALID_EMAIL_OR_PASSWORD = new CastcleException('3002');
  static INVALID_EMAIL = new CastcleException('3003');
  static INVALID_PHONE_NUMBER = new CastcleException('3004');
  static PAYLOAD_CHANNEL_MISMATCH = new CastcleException('3005');
  static EMAIL_OR_PHONE_NOTFOUND = new CastcleException('3006');
  static PLEASE_TRY_AGAIN = new CastcleException('3007');
  static INVALID_OTP = new CastcleException('3008');
  static EXPIRED_OTP = new CastcleException('3009');
  static LOCKED_OTP = new CastcleException('3010');
  static INVALID_PASSWORD = new CastcleException('3011');
  static INVALID_REF_CODE = new CastcleException('3012');
  static INVALID_ROLE = new CastcleException('3013');
  static EMAIL_OR_PHONE_IS_EXIST = new CastcleException('3014');
  static PAGE_IS_EXIST = new CastcleException('3015');
  static USER_NAME_IS_EXIST = new CastcleException('3016');
  static USER_ID_IS_EXIST = new CastcleException('3017');
  static MOBILE_NUMBER_ALREADY_EXISTS = new CastcleException('3018');
  static SOCIAL_PROVIDER_IS_EXIST = new CastcleException('3019');
  static TWILIO_MAX_LIMIT = new CastcleException('3020');
  static DUPLICATE_EMAIL = new CastcleException('3021');
  static TWILIO_TOO_MANY_REQUESTS = new CastcleException('3022');
  static ADS_BOOST_STATUS_MISMATCH = new CastcleException('3023');
  static USER_OR_PAGE_NOT_FOUND = new CastcleException('4001');
  static CAMPAIGN_HAS_NOT_STARTED = new CastcleException('4002');
  static NOT_ELIGIBLE_FOR_CAMPAIGN = new CastcleException('4003');
  static REACHED_MAX_CLAIMS = new CastcleException('4004');
  static REWARD_IS_NOT_ENOUGH = new CastcleException('4005');
  static CHANGE_CASTCLE_ID_FAILED = new CastcleException('4006');
  static FEATURE_NOT_EXIST = new CastcleException('5001');
  static PAYLOAD_TYPE_MISMATCH = new CastcleException('5002');
  static CONTENT_NOT_FOUND = new CastcleException('5003');
  static RECAST_IS_EXIST = new CastcleException('5004');
  static LIKE_IS_EXIST = new CastcleException('5005');
  static NOTIFICATION_NOT_FOUND = new CastcleException('6001');
  static SOMETHING_WRONG = new CastcleException('7001');
  static INVALID_TRANSACTIONS_DATA = new CastcleException('8001');
}
