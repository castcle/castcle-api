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
  C_ACCOUNT_NO,
  EntityVisibility,
  NetworkType,
  OtpObjective,
  Repository,
  SendTransactionDto,
  TAccountService,
  TransactionData,
  TransactionDto,
  TransactionType,
  User,
  WalletType,
} from '@castcle-api/database';
import { TwilioChannel } from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { WalletResponse } from '../dtos';

@Injectable()
export class WalletService {
  constructor(
    private authService: AuthenticationServiceV2,
    private repository: Repository,
    private tAccountService: TAccountService,
  ) {}

  async getWalletBalance(user: User): Promise<WalletResponse> {
    const balance = await this.tAccountService.getWalletBalance(user.id);

    return {
      id: user.id,
      displayName: user.displayName,
      castcleId: user.displayId,
      availableBalance: balance.personal,
      adsCredit: balance.ads,
      farmBalance: balance.farm,
      totalBalance: balance.total,
    };
  }

  async reviewTransaction({
    chainId,
    address,
    amount,
    requestedBy,
  }: TransactionDto & { requestedBy: string }) {
    const [network, balance] = await Promise.all([
      this.repository.findNetwork(chainId),
      this.tAccountService.getAvailableBalance(
        Types.ObjectId(requestedBy),
        WalletType.PERSONAL,
      ),
    ]);

    if (!network) {
      throw new CastcleException('NETWORK_NOT_FOUND');
    }
    if (network.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('NETWORK_TEMPORARILY_DISABLED');
    }
    if (amount > balance) {
      throw new CastcleException('NOT_ENOUGH_BALANCE');
    }
    if (network.type !== NetworkType.INTERNAL) {
      return { isInternalNetwork: false };
    }

    const receiver = await this.repository.findUser({ _id: address });
    if (!receiver) {
      throw new CastcleException('RECEIVER_NOT_FOUND');
    }
    if (requestedBy === receiver.id) {
      throw new CastcleException('PAYMENT_TO_OWN_WALLET');
    }

    return { isInternalNetwork: true };
  }

  async sendTransaction({
    transaction,
    verification,
    requestedBy,
  }: SendTransactionDto & { requestedBy: User }) {
    const { isInternalNetwork } = await this.reviewTransaction({
      ...transaction,
      requestedBy: requestedBy.id,
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

    if (!isInternalNetwork) throw new CastcleException('INTERNAL_SERVER_ERROR');

    await this.tAccountService.transfer({
      from: {
        user: requestedBy._id,
        type: WalletType.PERSONAL,
        value: transaction.amount,
      },
      to: [
        {
          user: requestedBy._id,
          type: isInternalNetwork
            ? WalletType.PERSONAL
            : WalletType.EXTERNAL_WITHDRAW,
          value: transaction.amount,
        },
      ],
      ledgers: [
        {
          credit: {
            cAccountNo: isInternalNetwork
              ? C_ACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL
              : C_ACCOUNT_NO.ASSET.CASTCLE_DEPOSIT,
            value: transaction.amount,
          },
          debit: {
            cAccountNo: C_ACCOUNT_NO.LIABILITY.USER_WALLET.PERSONAL,
            value: transaction.amount,
          },
        },
      ],
      data: {
        filter: {
          'wallet-balance': true,
          'deposit-send': true,
        },
        type: TransactionType.SEND,
      } as TransactionData,
    });
  }
}
