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
import { MetadataServiceV2 } from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CastcleController } from '@castcle-api/utils/decorators';
import { HttpCacheSharedInterceptor } from '@castcle-api/utils/interceptors';
import { CacheKey, CacheTTL, Get, UseInterceptors } from '@nestjs/common';

@CastcleController({ path: 'metadata', version: '1.0' })
export class LanguagesController {
  constructor(private metadataService: MetadataServiceV2) {}

  private logger = new CastLogger(LanguagesController.name);

  @UseInterceptors(HttpCacheSharedInterceptor)
  @CacheKey(CacheKeyName.LanguagesGet.Name)
  @CacheTTL(CacheKeyName.LanguagesGet.Ttl)
  @Get('languages')
  async getAllLanguage() {
    this.logger.log('Start get all language');
    const result = await this.metadataService.getAllLanguage();
    this.logger.log('Success get all language');
    return {
      payload: result.map(({ payload }) => payload),
    };
  }
}
