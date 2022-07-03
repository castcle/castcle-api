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
  DEFAULT_QUERY_OPTIONS,
  HashtagResponse,
  HashtagService,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CastcleAuth, CastcleController } from '@castcle-api/utils/decorators';
import {
  CredentialInterceptor,
  HttpCacheSharedInterceptor,
} from '@castcle-api/utils/interceptors';
import {
  CacheKey,
  CacheTTL,
  Get,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { KeywordHashtagPipe } from '../pipes/keyword.hashtag.pipe';

@CastcleController({ path: 'metadata', version: '1.0' })
export class HashtagsController {
  constructor(private hashtagService: HashtagService) {}

  private logger = new CastLogger(HashtagsController.name);

  @ApiBearerAuth()
  @UseInterceptors(HttpCacheSharedInterceptor)
  @CacheKey(CacheKeyName.Hashtags.Name)
  @CacheTTL(CacheKeyName.Hashtags.Ttl)
  @UseInterceptors(CredentialInterceptor)
  @Get('hashtags')
  async getAllHashtags(): Promise<HashtagResponse> {
    this.logger.log('Start get all hashtags');
    const result = await this.hashtagService.getAll();
    this.logger.log('Success get all hashtags');
    return {
      message: 'success',
      payload: result.map((hashtag) => hashtag.toHashtagPayload()),
    };
  }

  @Get('hashtag/search')
  @CastcleAuth(CacheKeyName.Hashtags)
  async hashtagSearch(@Query('keyword', KeywordHashtagPipe) keyword: string) {
    this.logger.log(`Hashtag search keyword: ${keyword}`);
    const result = await this.hashtagService.searchHashtag(keyword, {
      page: DEFAULT_QUERY_OPTIONS.page,
      limit: 10,
    });

    this.logger.log('Success search hashtags');
    return {
      payload: result.map((hashtag, index) =>
        hashtag.toSearchTopTrendhPayload(index),
      ),
    };
  }
}
