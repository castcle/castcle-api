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

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { getClientIp } from 'request-ip';

export class RequestMetadata {
  constructor(public ip?: string, public userAgent?: string) {}
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
  property?: keyof RequestMetadata
) => ParameterDecorator = createParamDecorator(
  async (property: keyof RequestMetadata, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent');
    const requestMetadata = new RequestMetadata(ip, userAgent);

    return property ? requestMetadata[property] : requestMetadata;
  }
);
