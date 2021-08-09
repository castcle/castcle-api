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
import { ErrorMessages } from './messages/default';

export enum CastcleStatus {
  REQUEST_URL_NOT_FOUND = '1001',
  MISSING_AUTHORIZATION_HEADER = '1002',
  INVALID_ACCESS_TOKEN = '1003',
  INVALID_REFRESH_TOKEN = '1004',
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
  USER_NAME_IS_EXISIT = '3016',
  USER_ID_IS_EXISIT = '3017',
  FEATURE_NOT_EXIST = '5001',
  PAYLOAD_TYPE_MISMATCH = '5002'
}

interface ErrorStatus {
  statusCode: string;
  code: string;
  message: string;
}

export class CastcleException extends HttpException {
  constructor(castcleStatus: CastcleStatus, language = 'en') {
    const error: ErrorStatus = ErrorMessages[castcleStatus];
    super(error, Number(error.statusCode));
  }
}
