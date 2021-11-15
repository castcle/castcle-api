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
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { Injectable } from '@nestjs/common';
import {
  AppleIdTokenType,
  AppleSignIn,
  RefreshTokenResponse
} from 'apple-sign-in-rest';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AppleClient {
  private readonly logger = new CastLogger(AppleClient.name, CastLoggerOptions);

  private readonly appleSignIn = new AppleSignIn({
    clientId: Environment.apple_client_id
      ? Environment.apple_client_id
      : 'com.my-company.my-app',
    teamId: Environment.apple_team_id
      ? Environment.apple_team_id
      : '5B645323E8',
    keyIdentifier: Environment.apple_key_identifier
      ? Environment.apple_key_identifier
      : 'U3B842SVGC',
    privateKey: Environment.apple_private_key
      ? Environment.apple_private_key
      : '-----BEGIN PRIVATE KEY-----\nMIGTAgEHIHMJKJyqGSM32AgEGC...'
  });

  /**
   * Request Authorizatio Url
   * @param {string} callBackUrl callBack Url
   * @returns {string} Authorization url
   */
  async requestAuthorizationUrl(callBackUrl: string): Promise<string> {
    this.logger.log('Request apple authorize url.');
    return await this.appleSignIn.getAuthorizationUrl({
      scope: ['name', 'email'],
      redirectUri: callBackUrl,
      state: new Date().getTime().toString(),
      nonce: uuidv4()
    });
  }

  /**
   * Verify Token
   * @param {string} token token
   * @param {string} nonce nonce
   * @param {string} subject subject
   * @returns {AppleIdTokenType} token data
   */
  async verifyToken(
    token: string,
    nonce: string,
    subject: string
  ): Promise<AppleIdTokenType> {
    this.logger.log('Verify apple token.');
    return await this.appleSignIn.verifyIdToken(token, {
      nonce: nonce,
      subject: subject,
      ignoreExpiration: true
    });
  }

  /**
   * Refresh Token
   * @param {string} clientSecret client secret
   * @param {string} refreshToken refresh token
   * @returns {RefreshTokenResponse} token data
   */
  async refreshToken(
    clientSecret: string,
    refreshToken: string
  ): Promise<RefreshTokenResponse> {
    this.logger.log('Refresh apple token.');
    return await this.appleSignIn.refreshAuthorizationToken(
      clientSecret,
      refreshToken
    );
  }
}
