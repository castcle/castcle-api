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

export enum TransactionFilter {
  AIRDROP_REFERRAL = 'airdrop-referral',
  CONTENT_FARMING = 'content-farming',
  DEPOSIT_SEND = 'deposit-send',
  SOCIAL_REWARDS = 'social-rewards',
  WALLET_BALANCE = 'wallet-balance',
}

export enum TransactionStatus {
  FAILED = 'failed',
  PENDING = 'pending',
  WITHDRAWING = 'withdrawing',
  VERIFIED = 'verified',
}

export enum TransactionType {
  AIRDROP = 'airdrop',
  DEPOSIT = 'deposit',
  CONTENT_REACH = 'content-reach',
  FARMED = 'farmed',
  FARMING = 'farming',
  RECEIVE = 'receive',
  REFERRAL = 'referral',
  SEEN_ADS = 'seen-ads',
  SEND = 'send',
  SOCIAL = 'social',
  UNFARMING = 'unfarming',
  WITHDRAW = 'withdraw',
}

export enum WalletType {
  // Castcle Wallet Type
  CASTCLE_AIRDROP = 'castcle.airdrop',
  CASTCLE_SOCIAL = 'castcle.social',
  EXTERNAL_DEPOSIT = 'external.deposit',
  EXTERNAL_WITHDRAW = 'external.withdraw',
  FEE = 'fee',

  // User Wallet Type
  ADS = 'ads',
  FARM_LOCKED = 'farm.locked',
  PERSONAL = 'personal',
}

export const UserWalletTypes = [
  WalletType.ADS,
  WalletType.FARM_LOCKED,
  WalletType.PERSONAL,
];
