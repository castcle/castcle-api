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
import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getClientIp } from 'request-ip';

export class RequestMetadata {
  device?: string;
  language: string;
  platform?: string;
  hostUrl?: string;
  ip?: string;
  userAgent?: string;
  source?: string;

  constructor(dto: Partial<RequestMetadata>) {
    if (!dto.language) {
      throw new CastcleException('MISSING_AUTHORIZATION_HEADERS');
    }

    this.device = dto.device;
    this.language = dto.language;
    this.platform = dto.platform;
    this.hostUrl = dto.hostUrl;
    this.ip = dto.ip;
    this.userAgent = dto.userAgent;
    this.source = dto.source;
  }
}

/**
 * Route handler parameter decorator. Extracts the ip and user agent from the request
 *
 * For example:
 * ```typescript
 * async create(@RequestMeta() requestMetadata: RequestMetadata)
 * ```
 *
 * @param property name of single property to extract from the request metadata object
 *
 * For example:
 * ```typescript
 * async create(@RequestMeta('ip') ip?: string)
 * ```
 */
export const RequestMeta = createParamDecorator(
  async (property: keyof RequestMetadata, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const requestMetadata = new RequestMetadata({
      device: req.headers['device'] as string,
      language: req.headers['accept-language'],
      platform: req.headers['platform'] as string,
      hostUrl: `${req.protocol}://${req.hostname}`,
      ip: getClientIp(req) || undefined,
      userAgent: req.headers['user-agent'] as string,
      source: getSource(req),
    });

    return property ? requestMetadata[property] : requestMetadata;
  },
) as (property?: keyof RequestMetadata) => ParameterDecorator;

const getSource = (req: FastifyRequest): string | undefined => {
  const header = req.headers['api-metadata'];
  const metadata = Array.isArray(header) ? header : header?.split(',');
  const sourceQuery = metadata?.find((meta) => meta.split('=')[0] === 'src');
  const source = sourceQuery?.split('=')[1];
  return source;
};
