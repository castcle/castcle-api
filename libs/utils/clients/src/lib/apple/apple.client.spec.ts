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

import { HttpModule } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AccessTokenResponse,
  AppleIdTokenType,
  RefreshTokenResponse,
} from 'apple-sign-in-rest';
import { AppleClient } from './apple.client';

export class AppleClientMock {
  async requestAuthorizationUrl(callBackUrl: string) {
    return callBackUrl;
  }

  async verifyToken(idToken: string): Promise<AppleIdTokenType> {
    let result;
    if (idToken === '1') {
      result = null;
    } else if (idToken === '2') {
      result = {
        iss: 'https://appleid.apple.com',
        aud: 'com.sarunw.siwa',
        exp: '1577943613',
        iat: '1577943013',
        sub: 'aaa.bbb.ccc',
        nonce: 'nounce',
        nonce_supported: true,
        c_hash: 'xxxx',
        email: 'xxxx@privaterelay.appleid.com',
        email_verified: true,
        is_private_email: true,
        auth_time: 1577943013,
      } as AppleIdTokenType;
    } else {
      result = {
        iss: 'https://appleid.apple.com',
        aud: 'com.sarunw.siwa',
        exp: '1577943613',
        iat: '1577943013',
        sub: 'xxx.yyy.zzz',
        nonce: 'nounce',
        nonce_supported: true,
        c_hash: 'xxxx',
        email: 'xxxx@privaterelay.appleid.com',
        email_verified: true,
        is_private_email: true,
        auth_time: 1577943013,
      } as AppleIdTokenType;
    }
    return result;
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    return {
      access_token: 'ACCESS_TOKEN',
      expires_in: 1577943013,
      token_type: 'refresh_token',
    };
  }

  async authorizationToken(): Promise<AccessTokenResponse> {
    return {
      // A token used to access allowed data. Currently has no use
      access_token: 'ACCESS_TOKEN',
      // It will always be Bearer.
      token_type: 'Bearer',
      // The amount of time, in seconds, before the access token expires.
      expires_in: 3600,
      // used to regenerate new access tokens. Store this token securely on your server.
      refresh_token: 'REFRESH_TOKEN',
      // A JSON Web Token that contains the user’s identity information.
      id_token: 'ID_TOKEN',
    };
  }
}

describe('AppleClient', () => {
  let service: AppleClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppleClient],
      imports: [HttpModule],
    }).compile();

    service = module.get<AppleClient>(AppleClient);
  });

  it('AppleClient - should be defined', () => {
    expect(service).toBeDefined();
  });
});
