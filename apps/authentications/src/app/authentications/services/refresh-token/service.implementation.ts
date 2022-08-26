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
  Account,
  EntityVisibility,
  User,
  UserField,
  UserType,
} from '@castcle-api/database';
import { IpAPI } from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshTokenDto, RefreshTokenService } from './service.abstract';

@Injectable()
export class RefreshTokenServiceImpl implements RefreshTokenService {
  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('User') private userModel: Model<User>,
    private ipAPI: IpAPI,
  ) {}

  async execute(dto: RefreshTokenDto) {
    const account = await this.getAccount(dto);
    const [token, { profile, pages }] = await Promise.all([
      account.regenerateToken({ refreshToken: dto.refreshToken }),
      this.getUserResponses(account),
    ]);

    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      profile,
      pages,
    };
  }

  private async getAccount(dto: RefreshTokenDto) {
    const [account, geolocation] = await Promise.all([
      this.accountModel.findOne({
        visibility: EntityVisibility.Publish,
        'credentials.refreshToken': dto.refreshToken,
        'credentials.refreshTokenExpiration': { $gte: new Date() },
      }),
      this.ipAPI.getGeolocation(dto.ip),
    ]);

    if (!account) throw new CastcleException('INVALID_REFRESH_TOKEN');

    return geolocation ? account.set({ geolocation }) : account;
  }

  private async getUserResponses(account: Account) {
    const userAndPages = !account.isGuest
      ? await this.userModel.find(
          {
            ownerAccount: account._id,
            $or: [
              {
                type: UserType.PEOPLE,
                visibility: [
                  EntityVisibility.Publish,
                  EntityVisibility.Illegal,
                ],
              },
              {
                type: UserType.PAGE,
                visibility: EntityVisibility.Publish,
              },
            ],
          },
          {},
          { sort: { updatedAt: -1 } },
        )
      : [];

    const indexOfUser = userAndPages.findIndex(
      ({ type }) => type === UserType.PEOPLE,
    );

    if (userAndPages[indexOfUser]?.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('ACCOUNT_DISABLED');
    }

    const responses = await Promise.all(
      userAndPages.map((userOrPage) =>
        userOrPage.toOwnerResponse(
          {
            expansionFields: [
              UserField.LinkSocial,
              UserField.SyncSocial,
              UserField.Wallet,
            ],
          },
          account,
        ),
      ),
    );

    return {
      profile: responses[indexOfUser],
      pages: responses.filter(({ type }) => type === UserType.PAGE),
    };
  }
}
