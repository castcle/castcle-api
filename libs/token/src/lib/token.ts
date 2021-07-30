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

import * as env from '@castcle-api/environments';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';
import { AuthenticationToken } from './authenticationToken';
import { AuthenticationTokenHeader } from './authenticationHeader';
import { CastcleException } from '@castcle-api/exception';

export enum TokenType {
  Access = 'access',
  Refresh = 'refresh',
  Signature = 'signature',
  Verify = 'verify'
}

export class Token {
  generateToken(
    payload: AuthenticationToken,
    type: TokenType,
    header: AuthenticationTokenHeader = null
  ): string {
    const config = this.getTokenConfig(type);
    if (!header) {
      header = {
        alg: 'HS256',
        typ: 'JWT'
      };
    }

    const token = jwt.sign(payload, config.secret, {
      algorithm: 'HS256',
      expiresIn: Number(config.expiresIn),
      header: header
    });
    return token;
  }

  getTokenConfig(type: TokenType) {
    return {
      secret: env.Environment[`jwt_${type}_secret`],
      expiresIn: env.Environment[`jwt_${type}_expires_in`]
    };
  }

  validateToken(token: string, type: TokenType): any {
    try {
      const config = this.getTokenConfig(type);
      const payload: jwt.JwtPayload = jwt.verify(
        token,
        config.secret
      ) as jwt.JwtPayload;
      const nowUnixSeconds = Math.round(Number(new Date()) / 1000);
      if (
        payload.exp - nowUnixSeconds >
        env.Environment.jwt_access_expires_in
      ) {
        let code = '1003';

        if (type === TokenType.Refresh) {
          code = '1004';
        }

        throw new CastcleException(code);
      }

      return payload;
    } catch (error) {
      throw new CastcleException('1002');
    }
  }
}
