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

import { Repository, User, UserDocument } from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastcleException } from '@castcle-api/utils/exception';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetWalletBalanceQuery, GetWalletBalanceResponse } from './query';

@QueryHandler(GetWalletBalanceQuery)
export class GetWalletBalanceHandler
  implements IQueryHandler<GetWalletBalanceQuery>
{
  constructor(
    @InjectModel('User') private userModel: Model<User>,
    private repository: Repository,
  ) {}

  async execute(
    command: GetWalletBalanceQuery,
  ): Promise<GetWalletBalanceResponse> {
    const [[walletBalance], user] = await Promise.all([
      this.repository.aggregateTransaction(command.user._id),
      command.user instanceof UserDocument
        ? command.user
        : this.userModel.findById(command.user),
    ]);

    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    return new GetWalletBalanceResponse({
      id: user._id,
      displayName: user.displayName,
      castcleId: user.displayId,
      availableBalance: Number(walletBalance?.available).toFixed(
        Environment.DECIMALS_FLOAT,
      ),
      adsCredit: Number(walletBalance?.ads).toFixed(Environment.DECIMALS_FLOAT),
      farmBalance: Number(walletBalance?.farm).toFixed(
        Environment.DECIMALS_FLOAT,
      ),
      totalBalance: Number(walletBalance?.total).toFixed(
        Environment.DECIMALS_FLOAT,
      ),
    });
  }
}
