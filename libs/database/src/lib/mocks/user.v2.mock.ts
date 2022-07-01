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

import { Password } from '@castcle-api/utils/commons';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateCredentialDto, EntityVisibility } from '../dtos';
import {
  AccountActivationType,
  AccountRequirements,
  AccountRole,
  UserType,
} from '../models';
import { Repository } from '../repositories';
import { Account } from '../schemas';
import { AuthenticationServiceV2 } from '../services/authentication.service.v2';

@Injectable()
export class MockUserService {
  constructor(
    private repository: Repository,
    private authenticationService: AuthenticationServiceV2,
  ) {}

  private async createAccount(no: number) {
    const requestOption: AccountRequirements = {
      device: 'mock',
      deviceUUID: `mock-${no}-${new Date().getTime()}`,
      header: {
        platform: 'mock-os',
      },
      languagesPreferences: ['th', 'th'],
    };

    const account = await this.repository.createAccount(requestOption);
    const { accessToken, accessTokenExpireDate } =
      this.repository.generateAccessToken({
        id: String(account._id),
        role: AccountRole.Guest,
        showAds: true,
      });

    const { refreshToken, refreshTokenExpireDate } =
      this.repository.generateRefreshToken({
        id: String(account._id),
      });

    const credential = await this.repository.createCredential({
      account: {
        _id: account._id,
        isGuest: true,
        preferences: {
          languages: requestOption.languagesPreferences,
        },
        visibility: EntityVisibility.Publish,
      },
      accessToken,
      accessTokenExpireDate,
      refreshToken,
      refreshTokenExpireDate,
      device: requestOption.device,
      platform: requestOption.header.platform,
      deviceUUID: requestOption.deviceUUID,
    } as CreateCredentialDto);

    (account.credentials ??= []).push({
      _id: Types.ObjectId(credential._id),
      deviceUUID: credential.deviceUUID,
    });

    return { account: await account.save(), credential };
  }

  private async createUser(name: string, no: number, account: Account) {
    const dto = {
      castcleId: `${name}-${no}-${new Date().getTime()}`,
      displayName: `${name}-${no}`,
      email: `${name}-${no}-${new Date().getTime()}@mock.com`,
      password: '2@MockPassword',
    };

    await this.repository.updateCredentials(
      { 'account._id': account._id },
      { isGuest: false },
    );

    account.isGuest = false;
    account.email = dto.email;

    account.password = Password.hash(dto.password);
    const activation = account.createActivation(AccountActivationType.EMAIL);

    (account.activations ??= []).push(activation);

    await account.save();
    await this.authenticationService.verifyEmail(activation.verifyToken);

    return this.repository.createUser({
      ownerAccount: account._id,
      displayId: dto.castcleId,
      displayName: dto.displayName,
      type: UserType.PEOPLE,
      email: dto.email,
    });
  }

  private async createPage(name: string, no: number, account: Account) {
    const dto = {
      castcleId: `${name}-${no}-${new Date().getTime()}`,
      displayName: `${name}-${no}`,
      email: `${name}-${no}-${new Date().getTime()}@mock.com`,
      password: '2@MockPassword',
    };

    return this.repository.createUser({
      ownerAccount: account._id,
      displayId: dto.castcleId,
      displayName: dto.displayName,
      type: UserType.PAGE,
      email: dto.email,
    });
  }

  generateMockUsers(amountUsers: number, amountPages?: number) {
    return Promise.all(
      [...Array(amountUsers)].fill('people').map(async (name, index) => {
        const { account, credential } = await this.createAccount(index);
        const user = await this.createUser(name, index, account);
        const pages = amountPages
          ? await Promise.all(
              [...Array(amountPages)]
                .fill('page')
                .map((page, index) => this.createPage(page, index, account)),
            )
          : undefined;

        return {
          account,
          user,
          pages,
          credential,
        };
      }),
    );
  }
}
