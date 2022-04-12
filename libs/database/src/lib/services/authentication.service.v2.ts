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

import { CastcleRegExp } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AccessTokenPayload,
  EntityVisibility,
  UserAccessTokenPayload,
} from '../dtos';
import { UserType } from '../models';
import { Account, Credential, User } from '../schemas';

@Injectable()
export class AuthenticationServiceV2 {
  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('User') private userModel: Model<User>
  ) {}

  private generateTokenPayload(credential: Credential, user: User) {
    if (credential.account.isGuest) {
      return {
        id: credential.account._id,
        preferredLanguage: credential.account.preferences.languages,
        role: 'guest',
        showAds: true,
      } as AccessTokenPayload;
    }

    return {
      id: credential.account._id,
      preferredLanguage: credential.account.preferences.languages,
      role: 'member',
      showAds: true,
      verified: user.verified,
    } as UserAccessTokenPayload;
  }

  /**
   * should remove account from credential.account and set it's new account to credential.account
   * @param {Credential} credential
   * @param {Account} account
   */
  private async linkCredentialToAccount(
    credential: Credential,
    account: Account
  ) {
    await this.accountModel.findByIdAndDelete(credential.account._id);
    await this.accountModel.updateOne(
      { _id: account._id },
      {
        $push: {
          credentials: {
            _id: Types.ObjectId(credential._id),
            deviceUUID: credential.deviceUUID,
          },
        },
      }
    );

    return credential
      .set({
        account: {
          _id: account._id,
          visibility: account.visibility,
          isGuest: account.isGuest,
          preferences: account.preferences,
          activateDate: account.activateDate,
          geolocation: account.geolocation,
        },
      })
      .save();
  }

  async loginWithEmail(
    credential: Credential,
    email: string,
    password: string
  ) {
    const account = await this.accountModel.findOne({
      email,
      visibility: EntityVisibility.Publish,
    });

    if (!account) throw CastcleException.INVALID_EMAIL;
    if (!account.verifyPassword(password)) {
      throw CastcleException.INVALID_EMAIL_OR_PASSWORD;
    }

    const isSameAccount = credential.account.id === account.id;
    const isLinkedCredential = account.credentials?.some(
      ({ deviceUUID }) => deviceUUID === credential.deviceUUID
    );

    if (!isLinkedCredential || !isSameAccount) {
      await this.linkCredentialToAccount(credential, account);
    }

    const users = await this.userModel.find(
      {
        ownerAccount: account._id,
        visibility: EntityVisibility.Publish,
      },
      {},
      { sort: { updatedAt: -1 } }
    );

    const user = users.find((user) => user.type === UserType.PEOPLE);
    const pages = users.filter((user) => user.type === UserType.PAGE);
    const tokenPayload = this.generateTokenPayload(credential, user);
    const { accessToken, refreshToken } = await credential.renewTokens(
      tokenPayload,
      { id: String(account._id) }
    );

    return {
      accessToken,
      refreshToken,
      profile: await user.toUserResponse(),
      pages: pages.map((page) => page.toPageResponse()),
    };
  }

  /**
   *  For check if account is existed
   * @param {string} id
   * @returns {User}
   */
  getExistedUserFromCastcleId = (id: string) => {
    return this.userModel
      .findOne({ displayId: CastcleRegExp.fromString(id) })
      .exec();
  };
}
