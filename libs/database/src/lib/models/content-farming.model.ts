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

import { ContentFarming } from '../schemas';

export type ContentFarmingCDF = {
  contentId: string;
  contentFarmings: ContentFarming[];
};

export class ContentFarmingResponse {
  'id': string;
  'number': number;
  'balance': {
    farmed: number;
    available: number;
    total: number;
    farming: number;
  } = {
    farmed: 0,
    available: 0,
    total: 0,
    farming: 0,
  };
  'status': string;
  constructor(
    contentFarming: ContentFarming,
    currentBalance: number,
    lockedBalance: number,
    farmNo: number,
  ) {
    //this.number
    this.id = contentFarming.id;
    this.number = farmNo;
    this.balance.available = currentBalance;
    this.balance.total = currentBalance + lockedBalance;
    this.status = contentFarming.status;
  }
}
