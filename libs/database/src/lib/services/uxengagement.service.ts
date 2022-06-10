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

import { CastLogger } from '@castcle-api/logger';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { UxEngagementBody, UxEngagementDto } from '../dtos/ux.engagement.dto';
import { Account, DsContentReach, UxEngagement } from '../schemas';

@Injectable()
export class UxEngagementService {
  #logger = new CastLogger(UxEngagementService.name);

  constructor(
    @InjectModel('Account')
    public _accountModel: Model<Account>,
    @InjectModel('UxEngagement')
    public _uxEngagementModel: Model<UxEngagement>,
    @InjectModel('DsContentReach')
    public reachModel: Model<DsContentReach>,
  ) {}

  /**
   * track data from info to UxEngagement collection by convert it to UxEngagementDto
   * convert timestamp to Date time
   * @param {UxEngagementBody} info
   * @returns {UxEngagement} return EngagementUx Document if could save
   */
  async track(info: UxEngagementBody) {
    const uxDto = {
      ...info,
      account: mongoose.Types.ObjectId(info.accountId),
      timestamp: new Date(Number(info.timestamp)),
    } as UxEngagementDto;
    const createResult = await new this._uxEngagementModel(uxDto).save();
    return createResult;
  }

  /**
   * Add reach to collection DsContentReach
   * @param accountId
   * @param contentIds
   */
  async addReachToContents(accountId: string, contentIds: string[]) {
    this.#logger.log(
      JSON.stringify({ accountId, contentIds }),
      'addReachToContents',
    );

    const existingReaches = await this.reachModel.find({
      content: { $in: contentIds },
    });

    const $reaches = contentIds.map((contentId) => {
      const reach = existingReaches.find(
        (reach) => String(reach.content) === String(contentId),
      );

      if (!reach) {
        return new this.reachModel({
          content: contentId,
          mappedAccount: { [accountId]: 1 },
          reachCount: 1,
        }).save();
      }

      reach.reachCount = reach.reachCount + 1;
      reach.markModified('mappedAccount');
      reach.mappedAccount[accountId] =
        (reach.mappedAccount[accountId] ?? 0) + 1;

      return reach.save();
    });

    const reaches = await Promise.all($reaches);

    return reaches;
  }
}
