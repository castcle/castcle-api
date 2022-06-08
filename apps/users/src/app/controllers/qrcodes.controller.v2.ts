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
  GetChianDto,
  GetSizeDto,
  UserService,
  UserServiceV2,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { Get, Param, Query } from '@nestjs/common';

@CastcleControllerV2({ path: 'qr-codes' })
export class QRCodeControllerV2 {
  constructor(
    private userService: UserService,
    private userServiceV2: UserServiceV2,
  ) {}

  @CastcleAuth(CacheKeyName.Users)
  @Get(':chainId/:userId')
  async createQRCode(
    @Auth() authorizer: Authorizer,
    @Param() { chainId, userId }: GetChianDto,
    @Query() { size }: GetSizeDto,
  ) {
    const user = await this.userService.findUser(userId);

    authorizer.requireActivation();

    return this.userServiceV2.createQRCode(chainId, size, user._id);
  }
}
