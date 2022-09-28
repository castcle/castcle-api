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

import { CastcleLogger } from '@castcle-api/common';
import {
  InjectQueue,
  Processor,
  Transaction,
  TransactionStatus,
  TransactionType,
  WalletType,
} from '@castcle-api/database';
import { OnQueueCompleted, Process } from '@nestjs/bull';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job, Queue } from 'bull';
import { Model, Types } from 'mongoose';
import {
  TransactionVerification,
  pipelineOfAirdropTransactionVerification,
  pipelineOfTransactionVerification,
} from './aggregation';

@Processor('new-transaction')
export class TransactionVerifier {
  private logger = new CastcleLogger(TransactionVerifier.name);
  private Error = {
    INSUFFICIENT_FUNDS: 'Insufficient funds',
    INVALID_CHECKSUM: 'Invalid checksum',
    INVALID_WALLET_TYPE: 'Invalid wallet type',
  };

  constructor(
    @InjectModel('Transaction') private txModel: Model<Transaction>,
    @InjectQueue('new-transaction') private txQueue: Queue<Transaction>,
    @InjectQueue('external-withdrawal') private withdrawer: Queue<Transaction>,
  ) {}

  @OnQueueCompleted()
  onVerificationCompleted({ id, data, returnvalue }: Job<Transaction>) {
    this.logger.log(
      JSON.stringify({
        transactionId: data._id,
        status: returnvalue.status,
        failureMessage: returnvalue.failureMessage,
      }),
      `${id}:onVerificationCompleted`,
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async addPendingTransactions() {
    const ctx = 'addPendingTransactions';
    const jobCounts = await this.txQueue.getJobCounts();
    this.logger.log(`remaining jobs: ${JSON.stringify(jobCounts)}`, ctx);
    if (jobCounts.waiting) return;

    const filter = { status: TransactionStatus.PENDING };
    const transactions = await this.txModel.find(filter).limit(5);
    const jobs = transactions.map((tx) => ({ data: tx }));
    await this.txQueue.addBulk(jobs);
    this.logger.log(`add new pending transactions: ${jobs.length} jobs`, ctx);
  }

  @Process()
  async handleTransaction({ id, data: tx }: Job<Transaction>) {
    const [validation] = await this.txModel.aggregate<TransactionVerification>(
      tx.type === TransactionType.AIRDROP
        ? pipelineOfAirdropTransactionVerification(tx)
        : pipelineOfTransactionVerification(tx),
    );

    this.logger.log(
      JSON.stringify({ transactionId: tx._id, ...validation }),
      `${id}:validationResult`,
    );

    if (!validation.isValidWalletType) {
      return this.markTransactionFailed(tx._id, this.Error.INVALID_WALLET_TYPE);
    }
    if (!validation.isValidChecksum) {
      return this.markTransactionFailed(tx._id, this.Error.INVALID_CHECKSUM);
    }
    if (!validation.isEnoughBalance) {
      return this.markTransactionFailed(tx._id, this.Error.INSUFFICIENT_FUNDS);
    }
    if (tx.to.some(({ type }) => type === WalletType.EXTERNAL_WITHDRAW)) {
      return this.markTransactionWithdrawing(tx._id);
    }

    return this.markTransactionVerified(tx._id);
  }

  private markTransactionFailed(id: Types.ObjectId, failureMessage: string) {
    return this.txModel.findByIdAndUpdate(
      id,
      { status: TransactionStatus.FAILED, failureMessage },
      { new: true },
    );
  }

  private markTransactionVerified(id: Types.ObjectId) {
    return this.txModel.findByIdAndUpdate(
      id,
      { status: TransactionStatus.VERIFIED },
      { new: true },
    );
  }

  private async markTransactionWithdrawing(id: Types.ObjectId) {
    const tx = await this.txModel.findByIdAndUpdate(
      id,
      { status: TransactionStatus.WITHDRAWING },
      { new: true },
    );

    await this.withdrawer.add(tx, { removeOnComplete: true });

    return tx;
  }
}
