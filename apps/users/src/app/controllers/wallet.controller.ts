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
  GetAccountParam,
  GetKeywordQuery,
  GetShortcutParam,
  GetUserParam,
  ReviewTransactionDto,
  SendTransactionDto,
  ShortcutInternalDto,
  ShortcutSortDto,
  TAccountService,
  UserServiceV2,
  WalletShortcutService,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import {
  Auth,
  Authorizer,
  CastcleAuth,
  CastcleBasicAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { HttpCacheIndividualInterceptor } from '@castcle-api/utils/interceptors';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { WalletHistoryQueryDto } from '../dtos/wallet.dto';
import { WalletService } from '../services/wallet.service';

@CastcleControllerV2({ path: 'wallets' })
export class WalletController {
  constructor(
    private tAccountService: TAccountService,
    private userService: UserServiceV2,
    private walletService: WalletService,
    private walletShortcutService: WalletShortcutService,
  ) {}

  @CastcleAuth(CacheKeyName.Users)
  @Get(':userId')
  async getUserWallet(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.getUser(userId);
    authorizer.requestAccessForAccount(user.ownerAccount);
    return this.walletService.getWalletBalance(user);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get(':userId/history')
  async getUserHistory(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
    @Query() query: WalletHistoryQueryDto,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.getUser(userId);
    authorizer.requestAccessForAccount(user.ownerAccount);
    return this.tAccountService.getWalletHistory(user.id, query.filter);
  }

  @CastcleBasicAuth()
  @Post(':userId/send/review')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reviewTransaction(
    @Auth() authorizer: Authorizer,
    @Body() { transaction }: ReviewTransactionDto,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.getUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    await this.walletService.reviewTransaction({
      ...transaction,
      requestedBy: user.id,
    });
  }

  @CastcleBasicAuth()
  @Post(':userId/send/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendTransaction(
    @Auth() authorizer: Authorizer,
    @Body() dto: SendTransactionDto,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.getUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    await this.walletService.sendTransaction({
      ...dto,
      requestedBy: user.id,
    });
  }

  @CastcleBasicAuth()
  @Post(':accountId/shortcuts/castcle')
  @HttpCode(HttpStatus.CREATED)
  async createWalletShortcut(
    @Auth() authorizer: Authorizer,
    @Param() { accountId }: GetAccountParam,
    @Body() body: ShortcutInternalDto,
  ) {
    authorizer.requestAccessForAccount(accountId);

    return this.walletShortcutService.createWalletShortcut(body, accountId);
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get(':accountId/shortcuts')
  async getWalletShortcut(
    @Auth() authorizer: Authorizer,
    @Param() { accountId }: GetAccountParam,
  ) {
    authorizer.requestAccessForAccount(accountId);

    return this.walletShortcutService.getWalletShortcut(accountId);
  }

  @CastcleBasicAuth()
  @Delete(':accountId/shortcuts/:shortcutId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWalletShortcut(
    @Auth() authorizer: Authorizer,
    @Param() { accountId, shortcutId }: GetShortcutParam,
  ) {
    authorizer.requestAccessForAccount(accountId);

    await this.walletShortcutService.deleteWalletShortcut(
      accountId,
      shortcutId,
    );
  }

  @CastcleBasicAuth()
  @Put(':accountId/shortcuts/sort')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sortWalletShortcut(
    @Auth() authorizer: Authorizer,
    @Param() { accountId }: GetAccountParam,
    @Body() { payload }: ShortcutSortDto,
  ) {
    authorizer.requestAccessForAccount(accountId);

    await this.walletShortcutService.sortWalletShortcut(payload, accountId);
  }

  @CastcleBasicAuth()
  @UseInterceptors(HttpCacheIndividualInterceptor)
  @Get(':userId/recent')
  async getAllWalletRecent(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.getUser(userId);
    authorizer.requestAccessForAccount(user.ownerAccount);

    return this.tAccountService.getAllWalletRecent(user.id);
  }

  @CastcleBasicAuth()
  @UseInterceptors(HttpCacheIndividualInterceptor)
  @Get(':userId/recent/search/by')
  async getAllWalletRecentSearch(
    @Auth() authorizer: Authorizer,
    @Param() { isMe, userId }: GetUserParam,
    @Query() { keyword }: GetKeywordQuery,
  ) {
    const user = isMe
      ? authorizer.user
      : await this.userService.getUser(userId);

    authorizer.requestAccessForAccount(user.ownerAccount);

    return this.tAccountService.getAllWalletRecent(user.id, keyword);
  }
}
