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
import { CastcleException, CastcleStatus } from './castcle.exception';
import { ErrorMessages } from './messages/default';

describe('CastcleException', () => {
  it(`should throw REQUEST_URL_NOT_FOUND and code ${CastcleStatus.REQUEST_URL_NOT_FOUND} when called`, () => {
    const throwResult = () => {
      throw new CastcleException(CastcleStatus.REQUEST_URL_NOT_FOUND);
    };
    expect(throwResult).toThrow(CastcleException);
    expect(throwResult).toThrowError(
      ErrorMessages[CastcleStatus.REQUEST_URL_NOT_FOUND].message
    );
  });
  const testStatus = [
    'MISSING_AUTHORIZATION_HEADER',
    'INVALID_ACCESS_TOKEN',
    'INVALID_REFRESH_TOKEN',
    'INVALID_FORMAT',
    'UPLOAD_FAILED',
    'INVLAID_AUTH_TOKEN',
    'INVALID_EMAIL_OR_PASSWORD',
    'INVALID_EMAIL',
    'INVALID_PHONE_NUMBER',
    'PAYLOAD_CHANNEL_MISMATCH',
    'EMAIL_OR_PHONE_NOTFOUND',
    'PLEASE_TRY_AGAIN',
    'INVALID_OTP',
    'EXPIRED_OTP',
    'LOCKED_OTP',
    'INVALID_PASSWORD',
    'INVLAID_REFCODE',
    'INVALID_ROLE',
    'EMAIL_OR_PHONE_IS_EXIST',
    'PAGE_IS_EXIST',
    'USER_ID_IS_EXIST',
    'MOBILE_NUMBER_IS_EXIST',
    'FEATURE_NOT_EXIST',
    'PAYLOAD_TYPE_MISMATCH',
    'NOTIFICATION_NOT_FOUND',
    'SOCIAL_PROVIDER_IS_EXIST',
    'TWILLIO_MAX_LIMIT',
  ];
  testStatus.forEach((STATUS) => {
    it(`should throw ${STATUS} and code ${
      CastcleStatus[STATUS]
    } with message '${
      ErrorMessages[CastcleStatus[STATUS]].message
    }' when called`, () => {
      const throwResult = () => {
        throw new CastcleException(CastcleStatus[STATUS]);
      };
      expect(throwResult).toThrow(CastcleException);
      expect(throwResult).toThrowError(
        ErrorMessages[CastcleStatus[STATUS]].message
      );
    });
  });
});
