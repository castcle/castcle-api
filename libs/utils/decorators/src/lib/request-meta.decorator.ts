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

import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getClientIp } from 'request-ip';

export class RequestMetadata {
  constructor(
    public hostUrl?: string,
    public ip?: string,
    public userAgent?: string,
    public source?: string,
  ) {}
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
export const RequestMeta: (
  property?: keyof RequestMetadata,
) => ParameterDecorator = createParamDecorator(
  async (property: keyof RequestMetadata, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] as string;
    const hostUrl = `${req.protocol}://${req.hostname}`;
    const metadata = req.headers['API-Metadata']
      ? req.headers['API-Metadata']
      : req.headers['api-metadata'];
    const source = (metadata as string)?.split(',').reduce((metadata, data) => {
      const [k, v] = data.split('=');
      metadata[k] = v;
      return metadata;
    }, {} as Record<string, string>).src;
    const requestMetadata = new RequestMetadata(hostUrl, ip, userAgent, source);

    return property ? requestMetadata[property] : requestMetadata;
  },
);
