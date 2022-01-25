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

export enum CastcleStatus {
  REQUEST_URL_NOT_FOUND = '1001',
  MISSING_AUTHORIZATION_HEADER = '1002',
  INVALID_ACCESS_TOKEN = '1003',
  INVALID_REFRESH_TOKEN = '1004',
  INVALID_FORMAT = '1005',
  UPLOAD_FAILED = '1006',
  FORBIDDEN_REQUEST = '1007',
  INVALID_MAX_RESULT = '1008',
  INVLAID_AUTH_TOKEN = '3001',
  INVALID_EMAIL_OR_PASSWORD = '3002',
  INVALID_EMAIL = '3003',
  INVALID_PHONE_NUMBER = '3004',
  PAYLOAD_CHANNEL_MISMATCH = '3005',
  EMAIL_OR_PHONE_NOTFOUND = '3006',
  PLEASE_TRY_AGAIN = '3007',
  INVALID_OTP = '3008',
  EXPIRED_OTP = '3009',
  LOCKED_OTP = '3010',
  INVALID_PASSWORD = '3011',
  INVLAID_REFCODE = '3012',
  INVALID_ROLE = '3013',
  EMAIL_OR_PHONE_IS_EXIST = '3014',
  PAGE_IS_EXIST = '3015',
  USER_NAME_IS_EXIST = '3016',
  USER_ID_IS_EXIST = '3017',
  MOBILE_NUMBER_IS_EXIST = '3018',
  SOCIAL_PROVIDER_IS_EXIST = '3019',
  TWILLIO_MAX_LIMIT = '3020',
  DUPLICATE_EMAIL = '3021',
  USER_OR_PAGE_NOT_FOUND = '4001',
  FEATURE_NOT_EXIST = '5001',
  PAYLOAD_TYPE_MISMATCH = '5002',
  RECAST_IS_EXIST = '5004',
  NOTIFICATION_NOT_FOUND = '6001',
  SOMETHING_WRONG = '7001',
}

interface ErrorStatus {
  statusCode: string;
  code: string;
  message: string;
}

export class CastcleException extends HttpException {
  public errorStatus: ErrorStatus;

  constructor(castcleStatus: keyof typeof ErrorMessages, language = 'en') {
    const error: ErrorStatus = LocalErrorMessage[language]
      ? LocalErrorMessage[language][castcleStatus]
      : ErrorMessages[castcleStatus];
    super(error, Number(error.statusCode));
    this.errorStatus = error;
  }

  getLocalStatus(language: string) {
    if (LocalErrorMessage[language])
      return LocalErrorMessage[language][this.errorStatus.code];
    else return LocalErrorMessage.default[this.errorStatus.code];
  }

  static REQUEST_URL_NOT_FOUND = new CastcleException('1001');
  static MISSING_AUTHORIZATION_HEADERS = new CastcleException('1002');
  static INVALID_ACCESS_TOKEN = new CastcleException('1003');
  static FORBIDDEN = new CastcleException('1007');
  static USER_OR_PAGE_NOT_FOUND = new CastcleException('4001');
  static CONTENT_NOT_FOUND = new CastcleException('5003');
}
