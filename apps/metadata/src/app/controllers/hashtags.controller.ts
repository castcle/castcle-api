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
import { HashtagService } from '@castcle-api/database';
import { HashtagResponse, LanguageResponse } from '@castcle-api/database/dtos';
import { Configs } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  CredentialInterceptor,
  HttpCacheSharedInterceptor,
} from '@castcle-api/utils/interceptors';
import {
  CacheKey,
  CacheTTL,
  Controller,
  Get,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse } from '@nestjs/swagger';

@ApiHeader({
  name: Configs.RequiredHeaders.AcceptLanguage.name,
  description: Configs.RequiredHeaders.AcceptLanguage.description,
  example: Configs.RequiredHeaders.AcceptLanguage.example,
  required: true,
})
@ApiHeader({
  name: Configs.RequiredHeaders.AcceptVersion.name,
  description: Configs.RequiredHeaders.AcceptVersion.description,
  example: Configs.RequiredHeaders.AcceptVersion.example,
  required: true,
})
@Controller({
  version: '1.0',
})
@Controller()
export class HashtagsController {
  constructor(private hashtagService: HashtagService) {}

  private logger = new CastLogger(HashtagsController.name);

  @ApiBearerAuth()
  @ApiOkResponse({
    type: LanguageResponse,
  })
  @UseInterceptors(HttpCacheSharedInterceptor)
  @CacheKey(CacheKeyName.HashtagsGet.Name)
  @CacheTTL(CacheKeyName.HashtagsGet.Ttl)
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
}
