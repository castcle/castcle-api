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

import { Environment } from '@castcle-api/environments';
import { Token } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  AccessTokenPayload,
  SocialConnectDto,
  UserAccessTokenPayload,
} from '../dtos';
import { AccountActivationType, UserType } from '../models';
import { Account, AccountAuthenIdType, Credential, User } from '../schemas';
import { AnalyticService } from './analytic.service';
import { Repository } from '../repositories';
import { FacebookClient, TwitterClient } from '@castcle-api/utils/clients';

@Injectable()
export class AuthenticationServiceV2 {
  constructor(
    private analyticService: AnalyticService,
    private facebookClient: FacebookClient,
    private twitterClient: TwitterClient,
    private repository: Repository
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
    const isSameAccount = credential.account.id === account.id;
    const isLinkedCredential = account.credentials?.some(
      ({ deviceUUID }) => deviceUUID === credential.deviceUUID
    );

    if (isLinkedCredential && isSameAccount) {
      return credential;
    }

    const [linkedCredential] = await Promise.all([
      credential
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
        .save(),
      this.repository.deleteAccount({ _id: credential.account._id }),
      this.repository.updateAccount(
        { _id: account._id },
        {
          $push: {
            credentials: {
              _id: Types.ObjectId(credential._id),
              deviceUUID: credential.deviceUUID,
            },
          },
        }
      ),
    ]);

    return linkedCredential;
  }

  private async login(credential: Credential, account: Account) {
    const users = await this.repository.findUsers(
      { accountId: account._id },
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

  async loginWithEmail(
    credential: Credential,
    email: string,
    password: string
  ) {
    const account = await this.repository.findAccount({ email });

    if (!account) throw CastcleException.INVALID_EMAIL;
    if (!account.verifyPassword(password)) {
      throw CastcleException.INVALID_EMAIL_OR_PASSWORD;
    }

    await this.linkCredentialToAccount(credential, account);
    return this.login(credential, account);
  }

  async loginWithSocial(
    credential: Credential,
    socialConnectDto: SocialConnectDto & { ip: string; userAgent: string }
  ) {
    const { email, socialId, provider, ip, userAgent, authToken } =
      socialConnectDto;

    const socialIdFromCredential = await this.getSocialId(provider, authToken);

    if (socialId !== socialIdFromCredential) {
      throw CastcleException.INVALID_AUTH_TOKEN;
    }

    const accountFromSocial = await this.repository.findAccount({
      provider,
      socialId,
    });

    if (accountFromSocial) {
      await this.linkCredentialToAccount(credential, accountFromSocial);
      return this.login(credential, accountFromSocial);
    }

    if (email) {
      const isDuplicateEmail = await this.repository.findAccount({ email });
      if (isDuplicateEmail) throw CastcleException.DUPLICATE_EMAIL;
    }

    const registration = await this.registerWithSocial(
      credential,
      socialConnectDto
    );
    await this.analyticService.trackRegistration(ip, userAgent);
    return registration;
  }

  private async getSocialId(provider: AccountAuthenIdType, authToken: string) {
    switch (provider) {
      case AccountAuthenIdType.Facebook: {
        return this.facebookClient.getFacebookProfile(authToken);
      }
      case AccountAuthenIdType.Twitter: {
        const [token, secret] = authToken.split('|');
        return this.twitterClient.verifyCredentials(token, secret);
      }
    }
  }

  async registerWithSocial(
    credential: Credential,
    { ip, referral, ...registerDto }: SocialConnectDto & { ip: string }
  ) {
    const account = await this.repository.findAccount({
      _id: credential.account._id,
    });

    if (!account) throw CastcleException.INVALID_ACCESS_TOKEN;
    if (registerDto.email) {
      this.createAccountActivation(account, AccountActivationType.EMAIL, true);
      account.email = registerDto.email;
      account.activateDate = new Date();
    }

    (account.authentications ||= {})[registerDto.provider] = {
      socialId: registerDto.socialId,
      avatar: registerDto.avatar,
    };
    account.isGuest = false;

    await this.updateReferral(account, referral, ip);
    await account.save();
    await this.repository.createUser({
      ownerAccount: account._id,
      displayId: registerDto.displayName,
      displayName: registerDto.displayName,
      type: UserType.PEOPLE,
      profile: {
        images: {
          avatar: registerDto.avatar
            ? await this.repository.createProfileImage(
                account._id,
                registerDto.avatar
              )
            : null,
        },
      },
    });

    return this.login(credential, account);
  }

  private async updateReferral(
    account: Account,
    referrerId: string,
    ip: string
  ) {
    const referrer =
      (await this.repository.findUser({ _id: referrerId })) ||
      (await this.analyticService.getReferrer(ip));

    if (!referrer) return;

    account.referralBy = referrer._id;
    await this.repository.updateAccount(
      { _id: referrer._id },
      { $inc: { referralCount: 1 } }
    );
  }

  private createAccountActivation(
    account: Account,
    type: AccountActivationType,
    autoActivateEmail = false
  ) {
    const now = new Date();
    const verifyTokenExpireDate = new Date(
      now.getTime() + Environment.JWT_VERIFY_EXPIRES_IN * 1000
    );
    const verifyToken = Token.generateToken(
      {
        _id: account._id,
        verifyTokenExpiresTime: verifyTokenExpireDate.toISOString(),
      },
      Environment.JWT_VERIFY_SECRET,
      Environment.JWT_VERIFY_EXPIRES_IN
    );

    (account.activations ??= []).push({
      type,
      verifyToken,
      verifyTokenExpireDate,
      activationDate: autoActivateEmail ? now : undefined,
    });
  }

  /**
   * For check if castcle ID is existed
   * @param {string} castcleId
   * @returns user
   */
  getExistedUserFromCastcleId = (castcleId: string) => {
    return this.repository.findUser({ _id: castcleId });
  };

  /**
   * For check if email is existed
   * @param {email} email
   * @returns account
   */
  getAccountFromEmail = (email: string) => {
    return this.repository.findAccount({ email });
  };
}
