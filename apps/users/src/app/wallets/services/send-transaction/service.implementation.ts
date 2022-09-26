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
  AuthenticationServiceV2,
  InjectQueue,
  NetworkType,
  OtpObjective,
  Transaction,
  TransactionType,
  WalletType,
} from '@castcle-api/database';
import { TwilioChannel } from '@castcle-api/utils/clients';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { ReviewTransactionService } from '../review-transaction/service.abstract';
import { SendTransactionArg, SendTransactionService } from './service.abstract';

@Injectable()
export class SendTransactionServiceImpl implements SendTransactionService {
  constructor(
    @InjectModel('Transaction') private transactionModel: Model<Transaction>,
    @InjectQueue('new-transaction') private txQueue: Queue<Transaction>,
    private authService: AuthenticationServiceV2,
    private reviewTransactionService: ReviewTransactionService,
  ) {}

  async exec({ transaction, verification, requestedBy }: SendTransactionArg) {
    const { network, amount } = await this.reviewTransactionService.exec({
      ...transaction,
      requestedBy,
    });

    await this.authService.verifyOtp({
      channel: TwilioChannel.EMAIL,
      objective: OtpObjective.SEND_TOKEN,
      receiver: verification.email.email,
      refCode: verification.email.refCode,
      otp: verification.email.otp,
    });

    await this.authService.verifyOtp({
      channel: TwilioChannel.SMS,
      objective: OtpObjective.SEND_TOKEN,
      receiver:
        verification.mobile.countryCode + verification.mobile.mobileNumber,
      refCode: verification.mobile.refCode,
      otp: verification.mobile.otp,
    });

    const isInternalNetwork = network.type === NetworkType.INTERNAL;
    const tx = await new this.transactionModel({
      from: {
        user: requestedBy._id,
        type: WalletType.PERSONAL,
        value: Types.Decimal128.fromString(amount.total.toString()),
      },
      to: [
        isInternalNetwork
          ? {
              user: new Types.ObjectId(transaction.address),
              type: WalletType.PERSONAL,
              value: Types.Decimal128.fromString(amount.received.toString()),
            }
          : {
              address: transaction.address,
              chainId: network.chainId,
              tokenAddress: network.tokenAddress,
              memo: transaction.memo,
              type: WalletType.EXTERNAL_WITHDRAW,
              value: Types.Decimal128.fromString(amount.received.toString()),
            },
        ...(amount.fee.isGreaterThan(0)
          ? [
              {
                type: WalletType.FEE,
                value: Types.Decimal128.fromString(amount.fee.toString()),
              },
            ]
          : []),
      ],
      type: isInternalNetwork ? TransactionType.SEND : TransactionType.WITHDRAW,
      data: { note: transaction.note },
    }).save();

    await this.txQueue.add(tx, { removeOnComplete: true });

    return { amount, network };
  }
}
