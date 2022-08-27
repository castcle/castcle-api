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
  AuthenticationProvider,
  EntityVisibility,
  Repository,
  User,
  UserField,
  UserType,
} from '@castcle-api/database';
import { FacebookClient, TwitterClient } from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConnectWithSocialDto,
  ConnectWithSocialService,
} from './service.abstract';

@Injectable()
export class ConnectWithSocialServiceImpl implements ConnectWithSocialService {
  constructor(
    private facebookClient: FacebookClient,
    private repository: Repository,
    private twitterClient: TwitterClient,
    @InjectModel('User')
    private userModel: Model<User>,
  ) {}

  async execute(dto: ConnectWithSocialDto) {
    const account = dto.account;
    await this.verifyAuthToken(dto);
    const isSocialConnected = this.repository.findAccount({
      provider: dto.provider,
      socialId: dto.socialId,
    });

    if (!isSocialConnected) {
      throw new CastcleException('SOCIAL_PROVIDER_IS_EXIST');
    }

    const users = await this.userModel.find(
      {
        ownerAccount: account._id,
        visibility: [EntityVisibility.Publish, EntityVisibility.Illegal],
      },
      {},
      { sort: { updatedAt: -1 } },
    );
    const user = users.find((user) => user.type === UserType.PEOPLE);
    const pages = users.filter(
      (user) =>
        user.type === UserType.PAGE &&
        user.visibility === EntityVisibility.Publish,
    );

    if (user?.visibility !== EntityVisibility.Publish) {
      throw new CastcleException('ACCOUNT_DISABLED');
    }

    const [token, userResponse, pageResponses] = await Promise.all([
      account
        .set({
          [`authentications.${dto.provider}`]: {
            socialId: dto.socialId,
            avatar: dto.avatar,
          },
        })
        .regenerateToken({
          accessToken: dto.accessToken,
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
    ]);

    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      profile: userResponse,
      pages: pageResponses,
    };
  }

  private async verifyAuthToken(dto: ConnectWithSocialDto) {
    if (dto.provider === AuthenticationProvider.FACEBOOK) {
      const profile = await this.facebookClient.getFacebookProfile(
        dto.authToken,
      );
      if (dto.socialId !== profile?.id) {
        throw new CastcleException('INVALID_AUTH_TOKEN');
      }
    } else if (dto.provider === AuthenticationProvider.TWITTER) {
      const [token, secret] = dto.authToken.split('|');
      const profile = await this.twitterClient.verifyCredentials(token, secret);
      if (dto.socialId !== profile.id_str) {
        throw new CastcleException('INVALID_AUTH_TOKEN');
      }
    }
  }
}
