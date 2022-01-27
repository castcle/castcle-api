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

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { AccountDocument } from '../schemas/account.schema';
import { Transaction, UserDocument } from '../schemas';
import { TransactionDto } from '../dtos';

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel('Account') public _accountModel: Model<AccountDocument>,
    @InjectModel('User')
    public _userModel: Model<UserDocument>,
    @InjectModel('Transaction')
    public _transactionModel: Model<Transaction>
  ) {}

  /**
   *
   * @param TransactionDto
   * @returns {Transaction}
   */
  transfer = async (data: TransactionDto) => {
    const newTransaction = new this._transactionModel(data);
    return newTransaction.save();
  };

  /**
   * get total inflow and outflow from transactions collections
   * @param accountId
   * @returns {Promise<number>}
   */
  getBalance = async (accountId: string): Promise<number> => {
    console.log('accountId', accountId);

    const outflowRaws = await this._transactionModel.aggregate([
      {
        $match: {
          from: mongoose.Types.ObjectId(accountId),
        },
      },
      {
        $group: {
          _id: '$from',
          total: {
            $sum: '$value',
          },
        },
      },
    ]);

    const inflowRaws = await this._transactionModel.aggregate([
      {
        $match: {
          to: mongoose.Types.ObjectId(accountId),
        },
      },
      {
        $group: {
          _id: '$to',
          total: {
            $sum: '$value',
          },
        },
      },
    ]);

    console.log('inflows', inflowRaws);
    console.log('outflows', outflowRaws);

    return (
      (inflowRaws.length > 0 ? inflowRaws[0].total : 0) -
      (outflowRaws.length > 0 ? outflowRaws[0].total : 0)
    );
  };

  /**
   *
   * @param {UserDocument}
   * @returns {Promise<number>}
   */
  getUserBalance = async (user: UserDocument) =>
    this.getBalance(String(user.ownerAccount._id));
}
