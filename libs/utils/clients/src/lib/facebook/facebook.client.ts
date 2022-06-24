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
import { CastcleException } from '@castcle-api/utils/exception';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  FacebookAccessToken,
  FacebookTokenData,
  FacebookUserInfo,
} from './facebook.message';

@Injectable()
export class FacebookClient {
  private logger = new CastLogger(FacebookClient.name);

  constructor(private httpService: HttpService) {}
  private readonly accessTokenUrl = `${Environment.FACEBOOK_HOST}/oauth/access_token?`;
  private readonly verifyTokenUrl = `${Environment.FACEBOOK_HOST}/v12.0/debug_token?`;
  private readonly userInfoUrl = `${Environment.FACEBOOK_HOST}/v12.0/me?`;
  private subscribedUrl = (fbId: string) =>
    `${Environment.FACEBOOK_HOST}/v13.0/${fbId}/subscribed_apps?`;

  /**
   * Get Authentication token from facebook
   * @returns {FacebookAccessToken} access token
   */
  async getAccessToken() {
    const parameter = `client_id=${Environment.FACEBOOK_CLIENT_ID}&client_secret=${Environment.FACEBOOK_CLIENT_SECRET}&grant_type=client_credentials`;
    const url = `${this.accessTokenUrl}${parameter}`;
    this.logger.log('get facebook access token');

    return lastValueFrom(
      this.httpService
        .get<FacebookAccessToken>(url)
        .pipe(map(({ data }) => data)),
    );
  }

  /**
   * Validate user token
   * @param {string} accessToken access token from facebook
   * @param {string} userToken authorize user token
   * @returns {FacebookTokenData} token detail
   */
  async verifyUserToken(accessToken: string, userToken: string) {
    const parameter = `access_token=${accessToken}&input_token=${userToken}`;
    const url = `${this.verifyTokenUrl}${parameter}`;
    this.logger.log('verify user token');

    return lastValueFrom(
      this.httpService
        .get<{ data: FacebookTokenData }>(url)
        .pipe(map(({ data }) => data.data)),
    );
  }

  /**
   * Get User data from facebook
   * @param {string} userToken authorize user token
   * @returns {FacebookUserInfo} user data
   */
  async getUserInfo(userToken: string) {
    const parameter = `access_token=${userToken}&fields=first_name,last_name,picture,email,name`;
    const url = `${this.userInfoUrl}${parameter}`;
    this.logger.log('get user info');

    return lastValueFrom(
      this.httpService.get<FacebookUserInfo>(url).pipe(map(({ data }) => data)),
    );
  }

  /**
   * Get User data from facebook
   * @param {string} userToken authorize user token
   * @param {string} socialId facebook id
   * @returns {Object} facebook response
   */
  async subscribed(userToken: string, socialId: string) {
    const parameter = `access_token=${userToken}&subscribed_fields=feed`;
    const url = `${this.subscribedUrl(socialId)}${parameter}`;
    this.logger.log('get user info');

    return lastValueFrom(
      this.httpService.post(url).pipe(
        map(({ data }) => data),
        catchError(async (error) => this.logger.error(error)),
      ),
    );
  }
  /**
   * Get User data from facebook
   * @param {string} userToken authorize user token
   * @param {string} socialId facebook id
   * @returns {Object} facebook response
   */
  async unsubscribed(userToken: string, socialId: string) {
    const parameter = `access_token=${userToken}&subscribed_fields=feed`;
    const url = `${this.subscribedUrl(socialId)}${parameter}`;
    this.logger.log('get user info');

    return lastValueFrom(
      this.httpService.delete(url).pipe(
        map(({ data }) => data),
        catchError(async (error) => this.logger.error(error)),
      ),
    );
  }

  async subscribeApps(authToken: string, socialId: string) {
    const url = `${Environment.FACEBOOK_HOST}/v13.0/${socialId}/subscribed_apps?access_token=${authToken}&subscribed_fields=feed`;
    this.logger.log(JSON.stringify({ url }), `subscribeApps:${socialId}:init`);

    try {
      const { data } = await lastValueFrom(
        this.httpService.post<{ success: boolean }>(url),
      );

      this.logger.log(JSON.stringify({ data }), `subscribeApps:${socialId}`);

      return data;
    } catch (error) {
      this.logger.error(error, `subscribeApps:${socialId}`);
      throw new CastcleException('UNABLE_TO_SYNC');
    }
  }

  async unsubscribeApps(authToken: string, socialId: string) {
    const url = `${Environment.FACEBOOK_HOST}/v13.0/${socialId}/subscribed_apps?access_token=${authToken}&subscribed_fields=feed`;
    this.logger.log(
      JSON.stringify({ url }),
      `unsubscribeApps:${socialId}:init`,
    );

    try {
      const { data } = await lastValueFrom(
        this.httpService.delete<{ success: boolean }>(url),
      );

      this.logger.log(JSON.stringify({ data }), `unsubscribeApps:${socialId}`);

      return data;
    } catch (error) {
      this.logger.error(error, `unsubscribeApps:${socialId}`);
      throw new CastcleException('UNABLE_TO_SYNC');
    }
  }

  async getFacebookProfile(authToken: string) {
    const url = `${Environment.FACEBOOK_HOST}/v13.0/me?access_token=${authToken}`;

    try {
      const profile = await lastValueFrom(
        this.httpService
          .get<{ id: string; name: string }>(url)
          .pipe(map(({ data }) => data)),
      );

      this.logger.log(
        JSON.stringify({ profile }),
        `getFacebookProfile:${profile.id}`,
      );

      return profile;
    } catch (error) {
      this.logger.error(error, `getFacebookProfile`);
    }
  }
}
