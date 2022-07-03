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

import { Model } from 'mongoose';
import {
  CACCOUNT_NO,
  TransactionFilter,
  TransactionType,
  WalletType,
} from '../models';
import { Transaction, User } from '../schemas';

export const mockDeposit = (
  user: User,
  value: number,
  transactionModel: Model<Transaction>,
) => {
  console.log('mockDeposit', user._id);
  return new transactionModel({
    from: {
      type: WalletType.EXTERNAL_DEPOSIT,
      value: value,
    },
    to: [
      {
        user: user._id,
        type: WalletType.PERSONAL,
        value: value,
      },
    ],
    ledgers: [
      {
        credit: {
          caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
          value: value,
        },
        debit: {
          caccountNo: CACCOUNT_NO.ASSET.CASTCLE_DEPOSIT,
          value: value,
        },
      },
    ],
  }).save();
};

export const mockSend = (
  requestedBy: User,
  user: User,
  value: number,
  transactionModel: Model<Transaction>,
) => {
  return new transactionModel({
    from: {
      user: requestedBy._id,
      type: WalletType.PERSONAL,
      value: value,
    },
    to: [
      {
        user: user._id,
        type: WalletType.PERSONAL,
        value: value,
      },
    ],
    data: {
      type: TransactionType.SEND,
      filter: TransactionFilter.DEPOSIT_SEND,
    },
    ledgers: [
      {
        credit: {
          caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
          value: value,
        },
        debit: {
          caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
          value: value,
        },
      },
    ],
  }).save();
};
