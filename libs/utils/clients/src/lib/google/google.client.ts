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
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
@Injectable()
export class GoogleClient {
  private readonly logger = new CastLogger(
    GoogleClient.name,
    CastLoggerOptions
  );

  constructor(private httpService: HttpService) {}
  private readonly accessTokenUrl = `https://oauth2.googleapis.com/token`;
  private readonly verifyTokenUrl = `https://www.googleapis.com/oauth2/v2/userinfo`;

  /**
   * Get Authentication token from facebook
   * @returns {FacebookAccessToken} access token
   */
  async getAccessToken(code: string) {
    const { data } = await lastValueFrom(
      this.httpService.post(this.accessTokenUrl, {
        client_id: Environment.GOOGLE_CLIENT_ID,
        client_secret: Environment.GOOGLE_SECRET,
        redirect_uri: 'http://localhost:4300/authenticate/google',
        grant_type: 'authorization_code',
        code
      })
    );
    console.log(data); // { access_token, expires_in, token_type, refresh_token }
    return data.access_token;
    // const parameter = `client_id=${Environment.fb_client_id}&client_secret=${Environment.fb_client_secret}&grant_type=client_credentials`;
    // const url = `${this.accessTokenUrl}${parameter}`;
    // this.logger.log('get facebook access token');

    // return lastValueFrom(
    //   this.httpService
    //     .get<FacebookAccessToken>(url)
    //     .pipe(map(({ data }) => data))
    // );
  }

  /**
   * Get Authentication token from facebook
   * @returns {FacebookAccessToken} access token
   */
  async getGoogleUserInfo(accessToken: string) {
    const { data } = await lastValueFrom(
      this.httpService.get(this.verifyTokenUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
    );
    console.log(data); // { id, email, given_name, family_name }
    return data;
  }
}
