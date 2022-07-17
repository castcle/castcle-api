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

import { Configs, Environment } from '@castcle-api/environments';
import { CastcleImage } from '@castcle-api/utils/aws';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model } from 'mongoose';
import {
  GetBalanceResponse,
  GetWalletRecentResponse,
  pipelineOfGetBalanceFromWalletType,
  pipelineOfGetWalletRecentFromType,
} from '../aggregations';
import {
  RecentWalletResponse,
  RecentWalletsResponse,
  WalletResponseOptions,
} from '../dtos';
import {
  CACCOUNT_NO,
  CastcleNumber,
  TopUpDto,
  TransactionFilter,
  TransferDto,
  WalletHistoryResponseDto,
  WalletType,
} from '../models';
import { Repository } from '../repositories';
import {
  CAccount,
  CAccountNature,
  Transaction,
  User,
  WalletShortcut,
} from '../schemas';

@Injectable()
export class TAccountService {
  constructor(
    @InjectModel('Transaction') public _transactionModel: Model<Transaction>,
    @InjectModel('CAccount') public _caccountModel: Model<CAccount>,
    private repository: Repository,
  ) {}

  toRecentWalletResponse(
    user: User,
    shortcut?: WalletShortcut,
    overwrites?: WalletResponseOptions,
  ) {
    return {
      id: shortcut?._id ?? user._id,
      chainId: shortcut?.chainId ?? Environment.CHAIN_INTERNAL,
      castcleId: user.displayId,
      userId: user._id,
      type: user.type,
      order: shortcut?.order,
      displayName: shortcut?.displayName ?? user.displayName,
      images: {
        avatar: user.profile?.images?.avatar
          ? CastcleImage.sign(user.profile.images.avatar)
          : Configs.DefaultAvatarImages,
      },
      memo: shortcut?.memo,
      createdAt: shortcut?.createdAt ?? user.createdAt,
      updatedAt: shortcut?.updatedAt ?? user.updatedAt,
      ...overwrites,
    } as RecentWalletResponse;
  }

  getFindQueryForChild(caccount: CAccount) {
    const orQuery = [
      {
        'ledgers.debit.caccountNo': caccount.no,
      },
      {
        'ledgers.credit.caccountNo': caccount.no,
      },
    ];
    if (caccount.child)
      caccount.child.forEach((childNo) => {
        orQuery.push({
          'ledgers.debit.caccountNo': childNo,
        });
        orQuery.push({
          'ledgers.credit.caccountNo': childNo,
        });
      });
    return orQuery;
  }

  async _getLedgers(caccount: CAccount) {
    const orQuery = this.getFindQueryForChild(caccount);
    const findFilter: FilterQuery<Transaction> = {
      $or: orQuery,
    };
    return this._transactionModel.find(findFilter);
  }

  async getLedgers(caccountNo: string) {
    const caccount = await this._caccountModel.findOne({ no: caccountNo });
    return this._getLedgers(caccount);
  }

  /**
   * Get user's balance
   * @param {string} accountId
   */
  getAccountBalance = async (userId: string, walletType: WalletType) => {
    const [balance] =
      await this._transactionModel.aggregate<GetBalanceResponse>(
        pipelineOfGetBalanceFromWalletType(userId, walletType),
      );
    return CastcleNumber.from(balance?.total?.toString()).toNumber();
  };

  async validateTransfer(transferDTO: TransferDto) {
    //value from equal value to
    if (
      !(
        transferDTO.from.value ===
        transferDTO.to.reduce((prev, now) => prev + now.value, 0)
      )
    ) {
      return false;
    }

    //debit credit is balance
    const totalDebit = transferDTO.ledgers.reduce(
      (prev, now) => prev + now.debit.value,
      0,
    );
    const totalCredit = transferDTO.ledgers.reduce(
      (prev, now) => prev + now.credit.value,
      0,
    );
    if (
      !(totalDebit === totalCredit && totalDebit === transferDTO.from.value)
    ) {
      return false;
    }
    //validate source balance
    if (transferDTO.from.user && transferDTO.from.value) {
      const accountBalance = await this.getAccountBalance(
        transferDTO.from.user,
        transferDTO.from.type,
      );
      if (
        !(accountBalance >= 0 && accountBalance - transferDTO.from.value >= 0)
      )
        return false;
    }
    //simulate after transfer there is no minus balance
    //get all CAccount balance from ledgers
    //add the ledgers info and check if they all 0
    return true;
  }

  async transfers(transferDTO: TransferDto, session?: ClientSession) {
    //check if balance available
    if (await this.validateTransfer(transferDTO))
      return new this._transactionModel(transferDTO).save({ session: session });
    else throw new CastcleException('INVALID_TRANSACTIONS_DATA');
  }

  async getBalance(caccountNo: string) {
    //get account First
    const caccount = await this._caccountModel.findOne({ no: caccountNo });
    const txs = await this._getLedgers(caccount);
    const allDebit = txs.reduce((totalDebit, currentTx) => {
      return (
        totalDebit +
        currentTx.ledgers
          .filter(
            (t) =>
              caccount.child.findIndex(
                (childNo) => t.debit.caccountNo === childNo,
              ) >= 0 || caccount.no === t.debit.caccountNo,
          )
          .reduce((sumDebit, now) => now.debit.value + sumDebit, 0)
      );
    }, 0);
    const allCredit = txs.reduce((totalCredit, currentTx) => {
      return (
        totalCredit +
        currentTx.ledgers
          .filter(
            (t) =>
              caccount.child.findIndex(
                (childNo) => t.credit.caccountNo === childNo,
              ) >= 0 || caccount.no === t.credit.caccountNo,
          )
          .reduce((sumCredit, now) => now.debit.value + sumCredit, 0)
      );
    }, 0);
    if (caccount.nature === CAccountNature.DEBIT) return allDebit - allCredit;
    else return allCredit - allDebit;
  }

  async getWalletHistory(userId: string, filter: TransactionFilter) {
    const txs = await this._transactionModel.find({
      $or: [
        { 'from.user': userId, 'data.filter': filter },
        { 'to.user': userId, 'data.filter': filter },
      ],
    });

    const result: WalletHistoryResponseDto = {
      payload: txs.map((tx) => ({
        id: tx.id,
        status: 'success', //!!! TODO now all tx is success for now
        type: tx.data.type,
        value:
          String(tx.from.user) === String(userId)
            ? tx.from.value
            : tx.to.find((t) => String(t.user) === String(userId)).value,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      })),
    };
    return result;
  }
  /**
   * Use for dev only
   * @param topUpDto
   * @returns
   */
  topUp(topUpDto: TopUpDto) {
    switch (topUpDto.type) {
      case WalletType.ADS:
        return new this._transactionModel({
          from: {
            type: WalletType.EXTERNAL_DEPOSIT,
            value: topUpDto.value,
          },
          to: [
            {
              type: WalletType.ADS,
              value: topUpDto.value,
              user: topUpDto.userId,
            },
          ],
          ledgers: [
            {
              credit: {
                caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.ADS,
                value: topUpDto.value,
              },
              debit: {
                caccountNo: CACCOUNT_NO.ASSET.CASTCLE_DEPOSIT,
                value: topUpDto.value,
              },
            },
          ],
        }).save();
      case WalletType.PERSONAL:
        return new this._transactionModel({
          from: {
            type: WalletType.EXTERNAL_DEPOSIT,
            value: topUpDto.value,
          },
          to: [
            {
              type: WalletType.PERSONAL,
              value: topUpDto.value,
              user: topUpDto.userId,
            },
          ],
          ledgers: [
            {
              credit: {
                caccountNo: CACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
                value: topUpDto.value,
              },
              debit: {
                caccountNo: CACCOUNT_NO.ASSET.CASTCLE_DEPOSIT,
                value: topUpDto.value,
              },
            },
          ],
        }).save();
      default:
        throw new CastcleException('SOMETHING_WRONG');
    }
  }

  async getAllWalletRecent(
    userId: string,
    keyword?: { [key: string]: string },
  ): Promise<RecentWalletsResponse> {
    const transactions = !keyword
      ? await this._transactionModel.aggregate<GetWalletRecentResponse>([
          pipelineOfGetWalletRecentFromType(userId),
        ])
      : undefined;

    const userIds = transactions?.map(({ user }) => user);

    const users = await this.repository
      .findUsers(
        { _id: userIds, keyword },
        {
          limit: 100,
        },
      )
      .exec();

    return {
      castcle: users.map((user) => this.toRecentWalletResponse(user, null)),
      other: [], // TODO !!! Implement external chain
    };
  }
}
