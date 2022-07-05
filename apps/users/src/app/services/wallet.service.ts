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
  TAccountService,
  User,
  WalletShortcutService,
  WalletType,
} from '@castcle-api/database';
import { Injectable } from '@nestjs/common';
import { WalletHistoryQueryDto, WalletResponse } from '../dtos';

@Injectable()
export class WalletService {
  constructor(
    private taccountService: TAccountService,
    private walletShortcutService: WalletShortcutService,
  ) {}

  async getWalletBalance(user: User): Promise<WalletResponse> {
    const personalBalance = await this.taccountService.getAccountBalance(
      user.id,
      WalletType.PERSONAL,
    );
    const adsCreditBalance = await this.taccountService.getAccountBalance(
      user.id,
      WalletType.ADS,
    );
    const farmingBalance = await this.taccountService.getAccountBalance(
      user.id,
      WalletType.FARM_LOCKED,
    );
    return {
      id: user.id,
      displayName: user.displayName,
      castcleId: user.displayId,
      availableBalance: personalBalance,
      adsCredit: adsCreditBalance,
      farmBalance: farmingBalance,
      totalBalance: personalBalance + adsCreditBalance + farmingBalance,
    };
  }

  getWalletHistory(user: User, query: WalletHistoryQueryDto) {
    return this.taccountService.getWalletHistory(user.id, query.filter);
  }

  getAllWalletRecent(userId: string, keyword?: { [key: string]: string }) {
    return this.taccountService.getAllWalletRecent(userId, keyword);
  }
}
