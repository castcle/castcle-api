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
import { CredentialDocument } from '@castcle-api/database/schemas';
import { Request, Response } from 'express';
import { CastcleException } from '@castcle-api/utils/exception';
import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { TokenRequest } from '../token/token.interceptor';
import * as util from '../util';
import { Environment } from '@castcle-api/environments';
//for delete
export interface CredentialRequest extends TokenRequest {
  $credential: CredentialDocument;
}

@Catch(CastcleException)
export class ExceptionalInterceptor implements ExceptionFilter {
  catch(exception: CastcleException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const langague = util.getLangagueFromRequest(request);
    response
      .status(exception.getStatus())
      .json(
        Environment?.NODE_ENV &&
          (Environment.NODE_ENV === 'localhost' ||
            Environment.NODE_ENV === 'development')
          ? exception.getLocalStatus('dev')
          : exception.getLocalStatus(langague)
      );
  }
}
