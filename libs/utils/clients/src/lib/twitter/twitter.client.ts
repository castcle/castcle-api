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
import * as Crypto from 'crypto';
import * as OAuth1a from 'oauth-1.0a';
import { map } from 'rxjs';

@Injectable()
export class TwitterClient {
  private readonly logger = new CastLogger(
    TwitterClient.name,
    CastLoggerOptions
  );

  constructor(private httpService: HttpService) {}

  private readonly accessTokenUrl = `${Environment.twitter_host}/oauth/request_token`;
  //   private readonly verifyTokenUrl = `${Environment.twitter_host}/v12.0/debug_token?`;
  //   private readonly userInfoUrl = `${Environment.fb_hotwitter_hostst}/v12.0/me?`;

  private authHeader(request: OAuth.RequestOptions) {
    const oauth = new OAuth1a({
      consumer: {
        key: Environment.twitter_key,
        secret: Environment.twitter_secret_key
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return Crypto.createHmac('sha1', key)
          .update(base_string)
          .digest('base64');
      }
    });

    const authorization = oauth.authorize(request, {
      key: Environment.twitter_access_token,
      secret: Environment.twitter_token_secret
    });

    return oauth.toHeader(authorization);
  }
  async requestToken() {
    const request = {
      url: this.accessTokenUrl,
      method: 'POST'
    };

    const authHeader = this.authHeader(request);

    console.log(this.accessTokenUrl);
    console.log(authHeader);
    return await this.httpService
      .post(request.url, null, {
        headers: authHeader
      })
      .pipe(map(({ data }) => console.log(data)));
  }
}
