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
  Network,
  NetworkType,
  Repository,
} from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BigNumber } from 'bignumber.js';
import { Model } from 'mongoose';
import {
  ReviewTransactionArg,
  ReviewTransactionService,
} from './service.abstract';

@Injectable()
export class ReviewTransactionServiceImpl implements ReviewTransactionService {
  constructor(
    @InjectModel('Network') private networkModel: Model<Network>,
    private repository: Repository,
  ) {}

  async exec({ chainId, address, amount, requestedBy }: ReviewTransactionArg) {
    const [[balance], network] = await Promise.all([
      this.repository.aggregateTransaction(requestedBy._id),
      this.networkModel.findOne({
        chainId,
        type: { $in: [NetworkType.EXTERNAL, NetworkType.INTERNAL] },
      }),
    ]);

    if (!network) {
      throw new CastcleException('NETWORK_NOT_FOUND');
    }
    if (network.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('NETWORK_TEMPORARILY_DISABLED');
    }
    if (!network.chainId) {
      throw new CastcleException('NETWORK_TEMPORARILY_DISABLED');
    }

    const isExternalNetwork = network.type !== NetworkType.INTERNAL;
    if (isExternalNetwork && !network.tokenAddress) {
      throw new CastcleException('NETWORK_TEMPORARILY_DISABLED');
    }

    const total = BigNumber(amount);
    const feeBN = BigNumber(network.fee);
    const hasFee = feeBN.isGreaterThan(0);
    const fee = hasFee ? feeBN : BigNumber(0);
    const received = hasFee ? total.minus(fee) : total;
    if (!received.isGreaterThan(0)) {
      throw new CastcleException('RECEIVED_AMOUNT_GT_ZERO');
    }
    if (total.isGreaterThan(balance.available.toString())) {
      throw new CastcleException('NOT_ENOUGH_BALANCE');
    }
    if (isExternalNetwork) {
      return { network, amount: { total, received, fee } };
    }

    const receiver = await this.repository.findUser({ _id: address });
    if (receiver?.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('RECEIVER_NOT_FOUND');
    }
    if (requestedBy.id === receiver.id) {
      throw new CastcleException('PAYMENT_TO_OWN_WALLET');
    }

    return { network, amount: { total, received, fee }, receiver };
  }
}
