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
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { CastcleException } from './exception';

@Catch(CastcleException)
export class CastcleExceptionFilter implements ExceptionFilter {
  private logger = new CastLogger(CastcleExceptionFilter.name);

  catch(exception: CastcleException, host: ArgumentsHost) {
    this.logger.error(exception);

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const language = Environment.IS_PRODUCTION
      ? request.headers['accept-language']
      : 'dev';
    const localizedException = exception.getLocalizedException(language);

    return ctx
      .getResponse<FastifyReply>()
      .status(localizedException.getStatus())
      .send(localizedException.getResponse());
  }
}
