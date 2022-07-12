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
  EntityVisibility,
  NetworkType,
  Repository,
  TAccountService,
  TransactionDto,
  User,
  WalletType,
} from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { WalletResponse } from '../dtos';

@Injectable()
export class WalletService {
  constructor(
    private repository: Repository,
    private tAccountService: TAccountService,
  ) {}

  async getWalletBalance(user: User): Promise<WalletResponse> {
    const [adsCreditBalance, farmingBalance, personalBalance] =
      await Promise.all([
        this.tAccountService.getAccountBalance(user.id, WalletType.ADS),
        this.tAccountService.getAccountBalance(user.id, WalletType.FARM_LOCKED),
        this.tAccountService.getAccountBalance(user.id, WalletType.PERSONAL),
      ]);

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

  async reviewTransaction({
    chainId,
    address,
    amount,
    requestedBy,
  }: TransactionDto & { requestedBy: string }) {
    const [network, balance] = await Promise.all([
      this.repository.findNetwork(chainId),
      this.tAccountService.getAccountBalance(requestedBy, WalletType.PERSONAL),
    ]);

    if (!network) {
      throw new CastcleException('NETWORK_NOT_FOUND');
    }
    if (network.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('NETWORK_TEMPORARILY_DISABLED');
    }
    if (amount > balance) {
      throw new CastcleException('NOT_ENOUGH_BALANCE');
    }
    if (network.type !== NetworkType.INTERNAL) {
      return;
    }

    const receiver = await this.repository.findUser({ _id: address });
    if (!receiver) throw new CastcleException('RECEIVER_NOT_FOUND');
  }
}
