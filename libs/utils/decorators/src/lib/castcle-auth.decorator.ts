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
  AuthGuard,
  HttpCacheClearInterceptor,
  HttpCacheIndividualInterceptor,
} from '@castcle-api/utils/interceptors';
import {
  CacheKey,
  CacheTTL,
  UseGuards,
  UseInterceptors,
  applyDecorators,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

export function CastcleAuth(cacheConfig: { Name: string; Ttl: number }) {
  return applyDecorators(
    CacheKey(cacheConfig.Name),
    CacheTTL(cacheConfig.Ttl),
    UseInterceptors(HttpCacheIndividualInterceptor),
    ApiBearerAuth(),
    UseGuards(AuthGuard),
  );
}

export function CastcleBasicAuth() {
  return applyDecorators(ApiBearerAuth(), UseGuards(AuthGuard));
}

export function CastcleClearCacheAuth(cacheConfig: {
  Name: string;
  Ttl: number;
}) {
  return applyDecorators(
    CacheKey(cacheConfig.Name),
    ApiBearerAuth(),
    UseGuards(AuthGuard),
    UseInterceptors(HttpCacheClearInterceptor),
  );
}
