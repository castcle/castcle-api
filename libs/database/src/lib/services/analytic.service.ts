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
import { Model } from 'mongoose';
import { EventName } from '../models';
import { Repository } from '../repositories';
import { Analytic } from '../schemas';

@Injectable()
export class AnalyticService {
  constructor(
    @InjectModel('Analytic') private analyticModel: Model<Analytic>,
    private repository: Repository,
  ) {}

  async track(payload: Analytic) {
    const analytic = await this.analyticModel.findOne(
      {
        ip: payload.ip,
        src: payload.src,
        name: payload.name,
      },
      {},
      { sort: { createdAt: -1 } },
    );

    if (
      !analytic ||
      (analytic.name === EventName.INVITE_FRIENDS && analytic.registered)
    ) {
      return new this.analyticModel(payload).save();
    }

    return analytic
      .set({ data: payload.data, count: analytic.count + 1 })
      .save();
  }

  trackMobileVerification(
    ip: string,
    accountId: string,
    countryCode: string,
    mobileNumber: string,
  ) {
    return this.analyticModel.updateMany(
      { ip, 'registered.account': accountId },
      { mobileVerified: { countryCode, mobileNumber } },
    );
  }

  trackRegistration(ip: string, accountId: string) {
    return this.analyticModel.updateMany(
      { ip, registered: { $exists: false } },
      { registered: { account: accountId } },
    );
  }

  async getReferrer(ip: string) {
    const analytic = await this.analyticModel.findOne(
      { ip, name: EventName.INVITE_FRIENDS },
      {},
      { sort: { createdAt: -1 } },
    );

    return this.repository.findUser({ _id: analytic?.data });
  }
}
