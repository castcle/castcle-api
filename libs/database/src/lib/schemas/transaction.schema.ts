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

import { SchemaFactory } from '@nestjs/mongoose';
import { Model, Schema } from 'mongoose';
import { TransactionStatus, WalletType } from '../models';
import { ExternalWithdraw, TransactionDocument } from './transaction.document';

export type TransactionStaticMethods = Model<TransactionDocument>;

export interface TransactionMethods {
  hasExternalWithdrawal(): boolean;
  getExternalWithdrawals(): ExternalWithdraw[];
  markFailed(failureMessage: string): this;
  markVerified(): this;
}

export type Transaction = TransactionDocument & TransactionMethods;

export const TransactionSchema = SchemaFactory.createForClass(
  TransactionDocument,
) as Schema<TransactionDocument, TransactionStaticMethods, TransactionMethods>;

TransactionSchema.methods.hasExternalWithdrawal = function (this: Transaction) {
  return this.to.some(({ type }) => type === WalletType.EXTERNAL_WITHDRAW);
};

TransactionSchema.methods.getExternalWithdrawals = function (
  this: Transaction,
) {
  return this.to.filter(
    ({ type }) => type === WalletType.EXTERNAL_WITHDRAW,
  ) as ExternalWithdraw[];
};

TransactionSchema.methods.markFailed = function (
  this: Transaction,
  failureMessage: string,
) {
  return this.set({ status: TransactionStatus.FAILED, failureMessage });
};

TransactionSchema.methods.markVerified = function (this: Transaction) {
  return this.set({ status: TransactionStatus.VERIFIED });
};
