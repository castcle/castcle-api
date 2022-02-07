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
import { Auth, google } from 'googleapis';
@Injectable()
export class GoogleClient {
  private oauthClient: Auth.OAuth2Client;
  private logger = new CastLogger(GoogleClient.name);

  constructor() {
    this.oauthClient = new google.auth.OAuth2(
      Environment.GOOGLE_CLIENT_ID,
      Environment.GOOGLE_SECRET
    );
  }

  /**
   * Get Authentication token from facebook
   * @param {string} token access token from Google
   * @returns {TokenInfo} access token detail
   */
  async verifyToken(token: string) {
    return await this.oauthClient.getTokenInfo(token);
  }

  /**
   * Get Authentication token from facebook
   * @param {string} token access token from Google
   * @returns {Schema$Userinfo} user data
   */
  async getGoogleUserInfo(token: string) {
    const userInfoClient = google.oauth2('v2').userinfo;
    this.oauthClient.setCredentials({
      access_token: token,
    });

    const userInfoResponse = await userInfoClient.get({
      auth: this.oauthClient,
    });
    return userInfoResponse.data;
  }
}
