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

import { SocialSyncServiceV2, UserService } from '@castcle-api/database';
import { GetUserParam, SyncSocialDtoV2 } from '@castcle-api/database/dtos';
import {
  Auth,
  Authorizer,
  CastcleBasicAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { Body, Param, Post } from '@nestjs/common';

@CastcleControllerV2({ path: 'users' })
export class UsersControllerV2 {
  constructor(
    private socialSyncService: SocialSyncServiceV2,
    private userService: UserService
  ) {}

  @CastcleBasicAuth()
  @Post(':userId/sync-social')
  async syncSocial(
    @Auth() authorizer: Authorizer,
    @Body() syncSocialDto: SyncSocialDtoV2,
    @Param() { isMe, userId }: GetUserParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    return this.socialSyncService.sync(user.id, syncSocialDto);
  }
}
