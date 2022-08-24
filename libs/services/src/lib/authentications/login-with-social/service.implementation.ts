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
  AccountActivationType,
  Analytic,
  AuthenticationProvider,
  EntityVisibility,
  EventName,
  Repository,
  User,
  UserField,
  UserType,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import {
  FacebookClient,
  IpAPI,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LoginWithSocialDto, LoginWithSocialService } from './service.abstract';

@Injectable()
export class LoginWithSocialServiceImpl implements LoginWithSocialService {
  constructor(
    private facebookClient: FacebookClient,
    private ipAPI: IpAPI,
    private repository: Repository,
    private twitterClient: TwitterClient,
    @InjectModel('Account')
    private accountModel: Model<Account>,
    @InjectModel('Analytic')
    private analyticModel: Model<Analytic>,
    @InjectModel('User')
    private userModel: Model<User>,
  ) {}

  async execute(dto: LoginWithSocialDto) {
    await this.verifyAuthToken(dto);
    const [accountFromSocial, guest] = await Promise.all([
      this.repository.findAccount({
        provider: dto.provider,
        socialId: dto.socialId,
      }),
      this.accountModel.findOne({
        isGuest: true,
        visibility: EntityVisibility.Publish,
        'credentials.accessToken': dto.guestAccessToken,
        'credentials.accessTokenExpiration': { $gte: new Date() },
      }),
    ]);

    if (!guest) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }

    return accountFromSocial
      ? this.loginWithSocial(accountFromSocial, guest, dto)
      : this.registerWithSocial(guest, dto);
  }

  private async verifyAuthToken(dto: LoginWithSocialDto) {
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

  private async loginWithSocial(
    account: Account,
    guest: Account,
    dto: LoginWithSocialDto,
  ) {
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
      registered: true,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      profile: userResponse,
      pages: pageResponses,
    };
  }

  private async registerWithSocial(
    guestAccount: Account,
    dto: LoginWithSocialDto,
  ) {
    const [
      account,
      emailAlreadyExists,
      geolocation,
      isEmailDisposable,
      referrer,
    ] = await Promise.all([
      guestAccount ||
        this.accountModel.findOne({
          isGuest: true,
          visibility: EntityVisibility.Publish,
          'credentials.accessToken': dto.guestAccessToken,
          'credentials.accessTokenExpiration': { $gte: new Date() },
        }),
      dto.email ? this.repository.findAccount({ email: dto.email }) : false,
      this.ipAPI.getGeolocation(dto.ip),
      dto.email ? this.repository.isEmailDisposable(dto.email) : false,
      this.getReferrer(dto.referral, dto.ip),
    ]);

    if (!account) {
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }
    if (emailAlreadyExists) {
      throw new CastcleException('EMAIL_OR_PHONE_IS_EXIST');
    }
    if (isEmailDisposable) {
      throw new CastcleException('DUPLICATE_EMAIL');
    }

    account.isGuest = false;
    account.referralBy = referrer?._id;
    (account.authentications ||= {})[dto.provider] = {
      socialId: dto.socialId,
      avatar: dto.avatar,
    };

    if (dto.email) {
      account.createActivation(AccountActivationType.EMAIL, new Date());
      account.activateDate = new Date();
      account.email = dto.email;
    }
    if (geolocation) {
      account.geolocation = geolocation;
    }
    if (Environment.PDPA_ACCEPT_DATES.length) {
      account.set(`pdpa.${Environment.PDPA_ACCEPT_DATES[0]}`, true);
    }

    const user = await this.repository.createUser({
      ownerAccount: account._id,
      displayId: dto.displayName
        ? `@${dto.displayName}`
        : `@${dto.provider}${dto.socialId}`,
      displayName: dto.displayName || `${dto.provider}${dto.socialId}`,
      type: UserType.PEOPLE,
      email: dto.email,
      profile: {
        overview: dto.overview,
        socials: { [dto.provider]: dto.link },
        images: {
          avatar: dto.avatar
            ? await this.repository.createProfileImage(account._id, dto.avatar)
            : null,
          cover: dto.cover
            ? await this.repository.createCoverImage(account._id, dto.cover)
            : null,
        },
      },
    });

    const [token, userResponse] = await Promise.all([
      account.regenerateToken({ accessToken: dto.guestAccessToken }),
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
      this.analyticModel.updateMany(
        { ip: dto.ip, registered: { $exists: false } },
        { registered: { account: account._id } },
      ),
      referrer?.update({ $inc: { referralCount: 1 } }),
    ]);

    return {
      registered: false,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      profile: userResponse,
      pages: [],
    };
  }

  private async getReferrer(referrerCastcleId?: string, ip?: string) {
    const $referrerFromId = () => {
      return referrerCastcleId
        ? this.repository.findUser({ _id: referrerCastcleId })
        : null;
    };
    const $referrerFromIp = async () => {
      const analytic = ip
        ? await this.analyticModel.findOne(
            { ip, name: EventName.INVITE_FRIENDS },
            {},
            { sort: { createdAt: -1 } },
          )
        : null;
      if (!analytic) return;
      return this.repository.findUser({ _id: analytic?.data });
    };

    const referrer = (await $referrerFromId()) || (await $referrerFromIp());

    if (!referrer) return;

    return this.repository.findAccount({ _id: referrer.ownerAccount });
  }
}
