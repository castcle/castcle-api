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
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class TelegramClient {
  private readonly logger = new CastLogger(
    TelegramClient.name,
    CastLoggerOptions
  );

  constructor() {}

  /**
   * Validate user token
   * @param {string} accessToken access token from facebook
   * @param {string} userToken authorize user token
   * @returns {FacebookTokenData} token detail
   */
  async verifyUserToken(accessToken: string, userToken: string) {
    // crypto.createHash('sha256').update(pwd).digest('hex');
    const secret = createHash('sha256').update(TOKEN).digest();

    const checkString = Object.keys(data)
      .sort()
      .map((k) => `${k}=${data[k]}`)
      .join('\n');
    const hmac = createHmac('sha256', secret).update(checkString).digest('hex');
    return hmac === hash;
    // const parameter = `access_token=${accessToken}&input_token=${userToken}`;
    // const url = `${this.verifyTokenUrl}${parameter}`;
    // this.logger.log('verify user token');

    // return lastValueFrom(
    //   this.httpService
    //     .get<{ data: FacebookTokenData }>(url)
    //     .pipe(map(({ data }) => data.data))
    // );
  }
}
