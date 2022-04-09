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
  SocialSyncServiceV2,
  AuthenticationService,
  UserService,
  UserServiceV2,
} from '@castcle-api/database';
import {
  ExpansionQuery,
  GetUserParam,
  SyncSocialDtoV2,
  UpdateUserDtoV2,
} from '@castcle-api/database/dtos';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { Body, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CastcleDate } from '@castcle-api/utils/commons';
@CastcleControllerV2({ path: 'users' })
export class UsersControllerV2 {
  constructor(
    private socialSyncService: SocialSyncServiceV2,
    private authService: AuthenticationService,
    private userService: UserService,
    private userServiceV2: UserServiceV2
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

    return this.socialSyncService.sync(user, syncSocialDto);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get(':userId')
  async getUserById(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
    @Query() userQuery?: ExpansionQuery
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    return this.userServiceV2.getById(
      user,
      userId,
      undefined,
      userQuery?.hasRelationshipExpansion,
      userQuery?.userFields
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Users)
  @CastcleBasicAuth()
  @Put(':userId')
  async updateMyData(
    @Auth() authorizer: Authorizer,
    @Body() body: UpdateUserDtoV2,
    @Param() { isMe, userId }: GetUserParam
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.findUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    if (body.castcleId) {
      if (!CastcleDate.verifyUpdateCastcleId(user.displayIdUpdatedAt))
        throw CastcleException.CHANGE_CASTCLE_ID_FAILED;

      const userExisting = await this.authService.getExistedUserFromCastcleId(
        body.castcleId
      );

      if (String(userExisting?.id) !== String(user?.id))
        throw CastcleException.USER_ID_IS_EXIST;
    }

    const prepareUser = await this.userService.uploadUserInfo(
      body,
      authorizer.account._id
    );

    const updateUser = await this.userService.updateUser(user, prepareUser);
    return updateUser.toUserResponse();
  }
}
