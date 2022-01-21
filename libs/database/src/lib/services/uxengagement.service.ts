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
import { UxEngagementBody, UxEngagementDto } from '../dtos/ux.engagement.dto';
import { UxEngagementDocument } from '../schemas/uxengagement.schema';
import { DsContentReachDocument } from '../schemas/ds-content-reach.schema';

@Injectable()
export class UxEngagementService {
  constructor(
    @InjectModel('Account') public _accountModel: Model<AccountDocument>,
    @InjectModel('UxEngagement')
    public _uxEngagementModel: Model<UxEngagementDocument>,
    @InjectModel('DsContentReach')
    public _dsContentReachModel: Model<DsContentReachDocument>
  ) {}

  /**
   * track data from info to UxEngagement collection by convert it to UxEnagementDto
   * convert timestamp to Date time
   * @param {UxEngagementBody} info
   * @returns {UxEngagementDocument} return EngagementUx Document if could save
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
   *
   * @param contentIds
   * @param userId
   * @returns {DsContentReachDocument[]}
   */
  async addReachToContents(contentIds: string[], userId: string) {
    console.log('contents', contentIds);
    return Promise.all(
      contentIds.map((id) => this.addReachToSingleContent(id, userId))
    );
  }

  /**
   * Add reach to collection DsContentReach
   * @param contentId
   * @param userId
   * @returns {DsContentReachDocument}
   */
  async addReachToSingleContent(
    contentId: string,
    accountId: string
  ): Promise<DsContentReachDocument> {
    const newMappedAccount: any = {};
    newMappedAccount[accountId] = 1;
    const setOnInsert = {
      content: contentId,
      mappedAccount: newMappedAccount,
      reachCount: 1,
    };
    console.log('setOnInsert', setOnInsert);
    const dsReach = await this._dsContentReachModel
      .findOne({ content: contentId })
      .exec();
    if (dsReach) {
      if (dsReach.mappedAccount[accountId]) {
        dsReach.mappedAccount[accountId] = dsReach.mappedAccount[accountId] + 1;
      } else {
        dsReach.mappedAccount[accountId] = 1;
      }
      dsReach.reachCount = dsReach.reachCount + 1;
      dsReach.markModified('mappedAccount');
      return dsReach.save();
    } else {
      return new this._dsContentReachModel(setOnInsert).save();
    }
  }
}
