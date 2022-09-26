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
  Processor,
  Transaction,
  TransactionStatus,
} from '@castcle-api/database';
import { OnQueueCompleted, Process } from '@nestjs/bull';
import { InjectModel } from '@nestjs/mongoose';
import { KMSSigner } from '@rumblefishdev/eth-signer-kms';
import { KMS } from 'aws-sdk';
import { Job } from 'bull';
import { Contract, Transaction as EtherTransaction, providers } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { Model } from 'mongoose';
import * as Cast from './Cast.json';

@Processor('external-withdrawal')
export class ExternalWithdrawer {
  private logger = new CastcleLogger(ExternalWithdrawer.name);
  private kms = new KMS({ region: process.env.KMS_REGION });
  private signers = new Map<string, KMSSigner>();

  private getSigner(chainId: string) {
    const existingSigner = this.signers.get(chainId);
    if (existingSigner) return existingSigner;

    const provider = this.getProvider(chainId);
    const signer = new KMSSigner(provider, this.getKeyId(), this.kms);
    return this.signers.set(chainId, signer).get(chainId);
  }

  private getProvider(network: providers.Networkish) {
    return new providers.InfuraProvider(network, process.env.INFURA_PROJECT_ID);
  }

  private getKeyId() {
    return process.env.KMS_KEY_ID;
  }

  constructor(
    @InjectModel('Transaction') private readonly txModel: Model<Transaction>,
  ) {}

  @OnQueueCompleted()
  onWithdrawalCompleted({ id, data, returnvalue }: Job<Transaction>) {
    this.logger.log(
      JSON.stringify({
        transactionId: data._id,
        status: returnvalue.status,
        failureMessage: returnvalue.failureMessage,
      }),
      `${id}:onWithdrawalCompleted`,
    );
  }

  @Process()
  async withdraw({ id, data: { _id } }: Job<Transaction>) {
    this.logger.log(`Transaction ID: ${_id}`, `withdraw:${id}`);
    const tx = await this.txModel.findById(_id);

    if (!tx) {
      return tx.markFailed('Transaction not found').save();
    }
    if (tx.status !== TransactionStatus.WITHDRAWING) {
      return tx.markFailed(`Invalid status (${tx.status})`).save();
    }
    if (!tx.hasExternalWithdrawal()) {
      return tx.markFailed('No external withdrawal').save();
    }

    const failureMessages: string[] = [];
    const $withdrawals = tx.getExternalWithdrawals().map(async (to, i) => {
      try {
        const signer = this.getSigner(to.chainId);
        const contract = new Contract(to.tokenAddress, Cast.abi, signer);
        const amount = parseUnits(to.value.toString(), 'ether');
        const { hash }: EtherTransaction = await contract.transfer(
          to.address,
          amount,
        );

        to.hash = hash;
        this.logger.log(`Successful on-chain withdrawal (ID: ${hash})`, tx.id);
      } catch (err: unknown) {
        this.logger.error(err, tx.id);
        const msg = err instanceof Error ? err.message : JSON.stringify(err);
        to.failureMessage = msg;
        failureMessages.push(`to.${i} error: ${msg}`);
      }
    });

    await Promise.all($withdrawals);
    return failureMessages.length
      ? tx.markFailed(`Failed to withdraw. ${failureMessages.join()}`).save()
      : tx.markVerified().save();
  }
}
