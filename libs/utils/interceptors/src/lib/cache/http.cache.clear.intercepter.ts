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
  CACHE_KEY_METADATA,
  CACHE_MANAGER,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as util from '../util';

@Injectable()
export class HttpCacheClearInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager,
    private reflector: Reflector
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler<any>) {
    //throw new Error('Method not implemented.');
    const cacheKey = this.reflector.get(
      CACHE_KEY_METADATA,
      context.getHandler()
    );
    if (cacheKey) {
      const request = context.switchToHttp().getRequest();
      const token = util.getTokenFromRequest(request);
      const setting: { [key: string]: any } =
        JSON.parse(await this.cacheManager.get(token)) || {};
      await Promise.all(
        Object.keys(setting).map((delKey) => this.cacheManager.del(delKey))
      );
      await this.cacheManager.del(token);
    }

    return next.handle();
  }
}
