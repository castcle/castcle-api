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
import * as OAuth from 'oauth';
import { TwitterAccessToken, TwitterUserData } from './twitter.message';
@Injectable()
export class TwitterClient {
  private logger = new CastLogger(TwitterClient.name);

  private readonly requestTokenUrl = `${Environment.TWITTER_HOST}/oauth/request_token`;
  private readonly accessTokenUrl = `${Environment.TWITTER_HOST}/oauth/access_token `;
  private readonly verifyToken = `${Environment.TWITTER_HOST}/1.1/account/verify_credentials.json?include_email=true`;

  private readonly oauth = new OAuth.OAuth(
    this.requestTokenUrl,
    this.accessTokenUrl,
    Environment.TWITTER_KEY,
    Environment.TWITTER_SECRET_KEY,
    '1.0A',
    null,
    'HMAC-SHA1'
  );

  /**
   * Request Twitter Access Token
   * @returns {TwitterAccessToken} token data
   */
  async requestToken(): Promise<TwitterAccessToken> {
    this.logger.log('call twitter api for request token');
    return new Promise((resolve, reject) => {
      this.oauth.getOAuthRequestToken(
        (error, oauth_token, oauth_token_secret, results) => {
          if (error) {
            reject(error);
          } else {
            resolve({ oauth_token, oauth_token_secret, results });
          }
        }
      );
    });
  }

  /**
   * Acces Twitter API from user token
   * @param {string} accessToken access token from twitter
   * @param {string} tokenSecret secret token from twitter
   * @param {string} oauthVerifier verify token from twitter
   * @returns {TwitterAccessToken} token data
   */
  async requestAccessToken(
    accessToken: string,
    tokenSecret: string,
    oauthVerifier: string
  ): Promise<TwitterAccessToken> {
    this.logger.log('call twitter api for request access token');
    return new Promise((resolve, reject) => {
      this.oauth.getOAuthAccessToken(
        accessToken,
        tokenSecret,
        oauthVerifier,
        (error, oauth_token, oauth_token_secret, results) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              oauth_token,
              oauth_token_secret,
              results,
            });
          }
        }
      );
    });
  }

  /**
   * Get User Data from user token
   * @param {string} accessToken access token from twitter
   * @param {string} tokenSecret secret token from twitter
   * @returns {TwitterAccessToken} token data
   */
  async requestVerifyToken(
    accessToken: string,
    tokenSecret: string
  ): Promise<TwitterUserData> {
    this.logger.log('call twitter api for request verify token');
    return new Promise((resolve, reject) => {
      this.oauth.getProtectedResource(
        this.verifyToken,
        'GET',
        accessToken,
        tokenSecret,
        (error, data) => {
          if (error) {
            reject(error);
          } else {
            const result = JSON.parse(data);
            resolve(result);
          }
        }
      );
    });
  }
}
