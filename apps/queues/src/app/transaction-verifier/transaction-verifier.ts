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
  QueueName,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@castcle-api/database';
import { CastLogger } from '@castcle-api/logger';
import { OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model, Types } from 'mongoose';
import {
  TransactionVerification,
  pipelineOfAirdropTransactionVerification,
  pipelineOfTransactionVerification,
} from './verification.aggregation';

@Processor(QueueName.NEW_TRANSACTION)
export class TransactionVerifier {
  private logger = new CastLogger(TransactionVerifier.name);
  private Error = {
    INSUFFICIENT_FUNDS: 'Insufficient funds',
    INVALID_CHECKSUM: 'Invalid checksum',
    INVALID_WALLET_TYPE: 'Invalid wallet type',
  };

  constructor(
    @InjectModel(Transaction.name) private txModel: Model<Transaction>,
  ) {}

  @Process()
  async handleTransaction({ id, data: tx }: Job<Transaction>) {
    const [validation] = await this.txModel.aggregate<TransactionVerification>(
      tx.type === TransactionType.AIRDROP
        ? pipelineOfAirdropTransactionVerification(tx)
        : pipelineOfTransactionVerification(tx),
    );

    this.logger.log(validation, `${id}:validationResult`);

    if (!validation.isValidWalletType) {
      return this.markTransactionFailed(tx._id, this.Error.INVALID_WALLET_TYPE);
    }
    if (!validation.isValidChecksum) {
      return this.markTransactionFailed(tx._id, this.Error.INVALID_CHECKSUM);
    }
    if (!validation.isEnoughBalance) {
      return this.markTransactionFailed(tx._id, this.Error.INSUFFICIENT_FUNDS);
    }

    return this.markTransactionVerified(tx._id);
  }

  @OnQueueCompleted()
  onVerificationComplete({ id, data, returnvalue }: Job<Transaction>) {
    this.logger.log(
      {
        transactionId: data._id,
        status: returnvalue.status,
        failureMessage: returnvalue.failureMessage,
      },
      `${id}:onVerificationComplete`,
    );
  }

  private async markTransactionVerified(id: Types.ObjectId) {
    return this.txModel.findByIdAndUpdate(
      id,
      { status: TransactionStatus.VERIFIED },
      { new: true },
    );
  }

  private async markTransactionFailed(
    id: Types.ObjectId,
    failureMessage: string,
  ) {
    return this.txModel.findByIdAndUpdate(
      id,
      { status: TransactionStatus.FAILED, failureMessage },
      { new: true },
    );
  }
}
