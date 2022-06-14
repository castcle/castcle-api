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
import { GetUserParam, UserServiceV2 } from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { Get, Param } from '@nestjs/common';
import { Types } from 'mongoose';

import { WalletService } from '../services/wallet.service';

@CastcleControllerV2({ path: 'wallets' })
export class WalletController {
  private logger = new CastLogger(WalletController.name);
  constructor(
    private userServiceV2: UserServiceV2,
    private walletService: WalletService,
  ) {}

  private validateObjectId(id: string) {
    this.logger.log(`Validate is object id: ${id}`);
    const ObjectId = Types.ObjectId;
    if (!ObjectId.isValid(id)) throw CastcleException.CONTENT_NOT_FOUND;
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get(':userId')
  async getUserWallet(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userServiceV2.getUser(userId);
    authorizer.requestAccessForAccount(user.ownerAccount);
    return this.walletService.getWalletBalance(user);
  }
}
