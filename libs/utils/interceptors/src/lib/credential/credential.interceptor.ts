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

import {
  Account,
  AuthenticationService,
  Credential,
  User,
  UserService,
} from '@castcle-api/database';
import { CastLogger } from '@castcle-api/logger';
import { CastcleException } from '@castcle-api/utils/exception';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { TokenRequest } from '../token/token.interceptor';
import { getLanguageFromRequest, getTokenFromRequest } from '../util';

export interface CredentialRequest extends TokenRequest {
  $account?: Promise<Account>;
  $credential?: Credential;
  $user?: Promise<User>;
}

@Injectable()
export class CredentialInterceptor implements NestInterceptor {
  #logger = new CastLogger(CredentialInterceptor.name);

  constructor(
    private authService: AuthenticationService,
    private userService: UserService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<CredentialRequest>();
    const accessToken = getTokenFromRequest(request);
    const language = getLanguageFromRequest(request);
    const credential = await this.authService.getCredentialFromAccessToken(
      accessToken,
    );

    request.$credential = credential;
    request.$language = language;
    request.$token = accessToken;
    request.$user = this.userService.getUserFromCredential(credential);
    request.$account = this.authService.getAccountFromId(
      credential?.account._id,
    );

    const isAccessTokenValid = request.$credential?.isAccessTokenValid();

    this.#logger.log(
      JSON.stringify({
        isAccessTokenValid,
        credentialId: request.$credential?._id,
        accountId: request.$credential?.account?._id,
      }),
    );

    if (!isAccessTokenValid) throw new CastcleException('INVALID_ACCESS_TOKEN');

    return next.handle();
  }
}
