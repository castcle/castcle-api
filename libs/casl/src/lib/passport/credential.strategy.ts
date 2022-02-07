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

//!!! This is draft for next sprint
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthenticationService } from '@castcle-api/database';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';

@Injectable()
export class CredentialStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthenticationService) {
    super({
      passReqToCallback: true,
    });
  }

  async validate(req: Request) {
    const haveAllHeader =
      req.headers['authorization'] && req.headers['accept-language'];
    if (!haveAllHeader)
      throw new CastcleException(
        CastcleStatus.MISSING_AUTHORIZATION_HEADER,
        req.headers['accept-language'] ? req.headers['accept-language'] : 'en'
      );
    const token = req.headers['authorization'].split(' ')[1];
    const credential = await this.authService.getCredentialFromAccessToken(
      token
    );
    if (credential) {
      return {
        $credential: credential,
        $language: req.headers['accept-language'],
      };
    } else
      throw new CastcleException(
        CastcleStatus.INVALID_ACCESS_TOKEN,
        req.headers['accept-language']
      );
  }
}
