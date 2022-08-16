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
  OtpObjective,
  QueueName,
  Transaction,
  TransactionType,
  WalletType,
} from '@castcle-api/database';
import { TwilioChannel } from '@castcle-api/utils/clients';
import { InjectQueue } from '@nestjs/bull';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { ReviewTransactionQuery } from '../review-transaction/query';
import { SendTransactionCommand } from './command';

@CommandHandler(SendTransactionCommand)
export class SendTransactionHandler
  implements ICommandHandler<SendTransactionCommand>
{
  constructor(
    @InjectModel('Transaction') private transactionModel: Model<Transaction>,
    @InjectQueue(QueueName.NEW_TRANSACTION) private txQueue: Queue<Transaction>,
    private authService: AuthenticationServiceV2,
    private queryBus: QueryBus,
  ) {}

  async execute({
    transaction,
    verification,
    requestedBy,
  }: SendTransactionCommand) {
    const { isInternalNetwork } = await this.queryBus.execute<
      ReviewTransactionQuery,
      { isInternalNetwork: boolean }
    >(new ReviewTransactionQuery({ ...transaction, requestedBy }));

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

    const value = Types.Decimal128.fromString(String(transaction.amount));
    const tx = await new this.transactionModel({
      from: {
        user: requestedBy._id,
        type: WalletType.PERSONAL,
        value,
      },
      to: [
        isInternalNetwork
          ? {
              user: new Types.ObjectId(transaction.address),
              type: WalletType.PERSONAL,
              value,
            }
          : {
              type: WalletType.EXTERNAL_WITHDRAW,
              value,
            },
      ],
      type: TransactionType.SEND,
      data: {
        address: transaction.address,
        chainId: transaction.chainId,
        memo: transaction.memo,
        note: transaction.note,
      },
    }).save();

    await this.txQueue.add(tx, { removeOnComplete: true });
  }
}
