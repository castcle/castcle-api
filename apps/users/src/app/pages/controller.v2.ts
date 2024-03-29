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
  PageDto,
  ResponseDto,
  SyncSocialDtoV2,
  UserServiceV2,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleController,
} from '@castcle-api/utils/decorators';
import {
  Body,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { DeleteUserDto, GetPageParam } from '../dtos';

@CastcleController({ path: 'v2/pages' })
export class PagesControllerV2 {
  constructor(private userServiceV2: UserServiceV2) {}

  @CastcleBasicAuth()
  @Post()
  async createPage(@Auth() authorizer: Authorizer, @Body() body: PageDto) {
    return this.userServiceV2.createPage(authorizer.user, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @CastcleClearCacheAuth(CacheKeyName.Pages)
  @Delete(':pageId')
  async deletePage(
    @Auth() { account }: Authorizer,
    @Param() { pageId }: GetPageParam,
    @Body() { password }: DeleteUserDto,
  ) {
    await this.userServiceV2.deletePage(account, pageId, password);
  }

  @CastcleBasicAuth()
  @Post('sync-social')
  async createPageAndSyncSocial(
    @Auth() authorizer: Authorizer,
    @Body() socialSyncDto: SyncSocialDtoV2,
  ) {
    authorizer.requestAccessForAccount(authorizer.user.ownerAccount);

    const createPage = await this.userServiceV2.createPageAndSyncSocial(
      authorizer.user,
      socialSyncDto,
    );

    return ResponseDto.ok({ payload: createPage });
  }
}
