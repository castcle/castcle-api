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

import { Account, EntityVisibility } from '@castcle-api/database';
import { IpAPI } from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GuestLoginDto, GuestLoginService } from './service.abstract';

@Injectable()
export class GuestLoginServiceImpl implements GuestLoginService {
  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    private ipAPI: IpAPI,
  ) {}

  async execute(dto: GuestLoginDto) {
    if (!dto.device || !dto.platform) {
      throw new CastcleException('MISSING_AUTHORIZATION_HEADERS');
    }
    const account = await this.getGuestAccount(dto);
    return account.generateToken({
      device: dto.device,
      deviceUUID: dto.deviceUUID,
      platform: dto.platform,
    });
  }

  private async getGuestAccount(dto: GuestLoginDto) {
    const [existingAccount, geolocation] = await Promise.all([
      this.accountModel.findOne({
        isGuest: true,
        visibility: EntityVisibility.Publish,
        'credentials.deviceUUID': dto.deviceUUID,
      }),
      this.ipAPI.getGeolocation(dto.ip),
    ]);
    const account =
      existingAccount ??
      new this.accountModel({
        visibility: EntityVisibility.Publish,
        isGuest: true,
        'preferences.languages': dto.preferLanguages,
      });

    return geolocation ? account.set({ geolocation }) : account;
  }
}
