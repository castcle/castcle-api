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

import { CastcleException } from '@castcle-api/utils/exception';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { CredentialDocument } from '../schemas/credential.schema';
import { AuthenticationService } from '../services/authentication.service';
import {
  getLanguageFromRequest,
  getTokenFromRequest,
} from '../utils/interceptors';
import { Token } from '../utils/token';
import { TokenRequest } from './token.interceptor';

export interface CredentialRequest extends TokenRequest {
  $credential: CredentialDocument;
}

@Injectable()
export class CredentialInterceptor implements NestInterceptor {
  constructor(private authService: AuthenticationService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    request.$language = getLanguageFromRequest(request);
    request.$token = getTokenFromRequest(request);

    request.$credential = await this.authService.accessTokenValid(
      request.$token,
    );

    request.$payload = Token.decodeToken(request.$token);

    if (request.$payload) {
      const userValid = await this.authService.decodeTokenValid(
        request.$payload,
      );
      if (request.$credential && userValid) {
        return next.handle();
      }
      throw CastcleException.INVALID_ACCESS_TOKEN;
    }

    throw CastcleException.INVALID_AUTH_TOKEN;
  }
}
