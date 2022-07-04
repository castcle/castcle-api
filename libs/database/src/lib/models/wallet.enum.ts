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

export enum WalletType {
  ADS = 'ads',
  LOCKING = 'locking',
  PERSONAL = 'personal',
  CASTCLE_MINT_CONTRACT = 'castcle.mintcontract',
  CASTCLE_TREASURY = 'castcle.treasury',
  CASTCLE_SOCIAL = 'castcle.social',
  CASTCLE_AIRDROP = 'castcle.airdrop',
  CASTCLE_REFERAL = 'castcle.referal',
  EXTERNAL_DEPOSIT = 'external.deposit',
  EXTERNAL_WITHDRAW = 'external.withdraw',
  EXTERNAL_MINT = 'external.mint',
  FARM_LOCKED = 'farm.locked',
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  SEND = 'send',
  RECEIVE = 'receive',
  WITHDRAW = 'withdraw',
  SOCIAL = 'social',
  REFERRAL = 'referral',
  AIRDROP = 'airdrop',
  FARMING = 'farming',
  UNFARMING = 'unfarming',
  FARMED = 'farmed',
}

export enum TransactionFilter {
  WALLET_BALANCE = 'wallet-balance',
  CONTENT_FARMING = 'content-farming',
  SOCIAL_REWARD = 'social-rewards',
  DEPOSIT_SEND = 'deposit-send',
  AIRDROP_REFERAL = 'airdrop-referral',
}
