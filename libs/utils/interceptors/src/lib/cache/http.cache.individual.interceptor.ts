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
  CacheInterceptor,
  CACHE_KEY_METADATA,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import * as util from '../util';

@Injectable()
export class HttpCacheIndividualInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const cacheKey = this.reflector.get(
      CACHE_KEY_METADATA,
      context.getHandler()
    );

    if (cacheKey) {
      const request = context.switchToHttp().getRequest();
      const token = util.getTokenFromRequest(request);
      const finalKey = `${cacheKey}-${token}-${request._parsedUrl.pathname}-${request._parsedUrl.query}`;
      console.debug('cache key:', finalKey);
      //get old setting
      console.debug('this.cacheManager.get(token)', token);
      this.cacheManager.get(token).then((resultSetting) => {
        console.debug('result get', resultSetting);
        const setting: { [key: string]: any } = JSON.parse(resultSetting) || {};
        console.log(token, 'setting', setting);
        setting[finalKey] = true;
        console.debug('new setting', setting);
        this.cacheManager.set(token, JSON.stringify(setting));
      });

      return finalKey;
    }

    return super.trackBy(context);
  }
}
