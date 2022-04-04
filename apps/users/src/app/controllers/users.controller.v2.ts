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
  UserServiceV2,
} from '@castcle-api/database';
import {
  GetUserParam,
  SyncSocialDtoV2,
  UpdateDataDto,
} from '@castcle-api/database/dtos';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  Auth,
  Authorizer,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { Body, Param, Post, Put, Req } from '@nestjs/common';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { Credential } from '@castcle-api/database/schemas';
import { Environment } from '@castcle-api/environments';
@CastcleControllerV2({ path: 'users' })
export class UsersControllerV2 {
  constructor(
    private socialSyncService: SocialSyncServiceV2,
    private authService: AuthenticationService,
    private userService: UserServiceV2
  ) {}

  _getUser = async (id: string, credential: Credential) => {
    if (id.toLocaleLowerCase() === 'me') {
      const me = await this.userService.getUserFromCredential(credential);
      if (!me) throw CastcleException.USER_OR_PAGE_NOT_FOUND;
      return me;
    } else {
      const user = await this.userService.getByIdOrCastcleId(id);
      if (!user) throw CastcleException.USER_OR_PAGE_NOT_FOUND;
      return user;
    }
  };

  _verifyUpdateCastcleId = (displayIdUpdateAt: Date) => {
    displayIdUpdateAt.setDate(
      displayIdUpdateAt.getDate() + Environment.CASTCLE_ID_ALLOW_UPDATE_DAYS
    );

    const now = new Date().getTime();
    const blockUpdate = displayIdUpdateAt.getTime();
    return now - blockUpdate >= 0;
  };

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

  @CastcleClearCacheAuth(CacheKeyName.Users)
  @CastcleBasicAuth()
  @Put(':id')
  async updateMyData(
    @Req() { $credential }: CredentialRequest,
    @Param('id') id: string,
    @Body() body: UpdateDataDto
  ) {
    const user = await this._getUser(id, $credential);
    if (!user) throw CastcleException.FORBIDDEN;

    if (String(user.ownerAccount) !== String($credential.account._id))
      throw CastcleException.FORBIDDEN;

    if (
      body.castcleId &&
      user.displayIdUpdatedAt &&
      !this._verifyUpdateCastcleId(user.displayIdUpdatedAt)
    )
      throw CastcleException.CHANGE_CASTCLE_ID_FAILED;

    if (body.castcleId) {
      const userExisting = await this.authService.getExistedUserFromCastcleId(
        body.castcleId
      );
      if (userExisting && userExisting.id !== user.id)
        throw CastcleException.USER_ID_IS_EXIST;
    }

    const prepareUser = await this.userService.uploadUserInfo(
      body,
      $credential.account._id
    );
    const updateUser = await this.userService.updateUser(user, prepareUser);
    const response = await updateUser.toUserResponse();
    return response;
  }
}
