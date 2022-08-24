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
import { LoginWithEmailDto, LoginWithEmailService } from './service.abstract';

@Injectable()
export class LoginWithEmailServiceImpl implements LoginWithEmailService {
  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('User') private userModel: Model<User>,
    private ipAPI: IpAPI,
  ) {}

  async execute(dto: LoginWithEmailDto) {
    const { account, guest, user, pages } = await this.getAccounts(dto);

    if (!guest) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }
    if (!account) {
      throw new CastcleException('INVALID_EMAIL');
    }
    if (!account.verifyPassword(dto.password)) {
      throw new CastcleException('INVALID_EMAIL_OR_PASSWORD');
    }
    if (user?.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('ACCOUNT_DISABLED');
    }

    const guestCredential = guest?.credentials.find(
      ({ accessToken }) => accessToken === dto.guestAccessToken,
    );

    if (!guestCredential) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }

    const [token, userResponse, pageResponses] = await Promise.all([
      account.generateToken({
        device: guestCredential.device,
        deviceUUID: guestCredential.deviceUUID,
        platform: guestCredential.platform,
      }),
      user.toOwnerResponse(
        {
          expansionFields: [
            UserField.LinkSocial,
            UserField.SyncSocial,
            UserField.Wallet,
          ],
        },
        account,
      ),
      Promise.all(
        pages.map((page) =>
          page.toOwnerResponse(
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
      ),
      guest.remove(),
    ]);

    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      profile: userResponse,
      pages: pageResponses,
    };
  }

  private async getAccounts(dto: LoginWithEmailDto) {
    const [account, guest, geolocation] = await Promise.all([
      this.accountModel.findOne({
        email: dto.email,
        isGuest: false,
        visibility: EntityVisibility.Publish,
      }),
      this.accountModel.findOne({
        isGuest: true,
        visibility: EntityVisibility.Publish,
        'credentials.accessToken': dto.guestAccessToken,
        'credentials.accessTokenExpiration': { $gte: new Date() },
      }),
      this.ipAPI.getGeolocation(dto.ip),
    ]);
    const users =
      account && guest
        ? await this.userModel.find(
            {
              ownerAccount: account._id,
              visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
            },
            {},
            { sort: { updatedAt: -1 } },
          )
        : [];
    const user = users.find((user) => user.type === UserType.PEOPLE);
    const pages = users.filter(
      (user) =>
        user.type === UserType.PAGE &&
        user.visibility === EntityVisibility.Publish,
    );

    return {
      account: geolocation ? account?.set({ geolocation }) : account,
      guest,
      pages,
      user,
    };
  }
}
