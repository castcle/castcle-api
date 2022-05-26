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

export const CACCOUNT_NO = {
  VAULT: {
    NO: '0000',
    AIRDROP: '0500',
  },
  ASSET: {
    NO: '1000',
    CASTCLE_WALLET: '1100',
    CASTCLE_DEPOSIT: '1200',
  },
  LIABILITY: {
    NO: '2000',
    USER_WALLET: {
      NO: '2100',
      PERSONAL: '2110',
      ADS: '2120',
    },
    LOCKED_TOKEN: {
      NO: '2200',
      PERSONAL: {
        NO: '2210',
        ADS: '2211',
        FARM: '2212',
      },
      ADS_CREDIT: {
        NO: '2220',
      },
    },
  },
  SOCIAL_REWARD: {
    NO: '9000',
    PERSONAL: {
      NO: '9100',
    },
    ADS_CREDIT: {
      NO: '9200',
    },
  },
};
