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
import { AppleSignIn } from 'apple-sign-in-rest';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AppleClient {
  private readonly logger = new CastLogger(AppleClient.name, CastLoggerOptions);

  private readonly appleSignIn = new AppleSignIn({
    clientId: Environment.apple_client_id,
    teamId: Environment.apple_team_id,
    keyIdentifier: Environment.apple_key_identifier,
    privateKey: Environment.apple_private_key
  });

  //   private readonly requestTokenUrl = `${Environment.twitter_host}/oauth/request_token`;
  //   private readonly accessTokenUrl = `${Environment.twitter_host}/oauth/access_token `;
  //   private readonly verifyToken = `${Environment.twitter_host}/1.1/account/verify_credentials.json?include_email=true`;

  /**
   * Request Twitter Access Token
   * @returns {TwitterAccessToken} token data
   */
  async requestToken(): Promise<string> {
    return await this.appleSignIn.getAuthorizationUrl({
      scope: ['name', 'email'],
      redirectUri: 'http://localhost:3000/auth/apple/callback',
      state: new Date().getTime().toString(),
      nonce: uuidv4()
    });
  }
}
