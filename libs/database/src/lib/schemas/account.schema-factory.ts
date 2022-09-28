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

import { Password } from '@castcle-api/common';
import { Environment } from '@castcle-api/environments';
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';
import { AccountRole } from '../models';
import { Account, AccountSchema } from './account.schema';

export const AccountSchemaFactory = (jwtService: JwtService) => {
  AccountSchema.methods.changePassword = function (
    this: Account,
    password: string,
    email?: string,
  ) {
    const encryptPassword = Password.hash(password);
    if (!encryptPassword) return null;

    this.password = encryptPassword;
    if (email) this.email = email;
    return this.save();
  };

  AccountSchema.methods.verifyPassword = function (password: string) {
    return Password.verify(password, this.password || '');
  };

  AccountSchema.methods.createActivation = function (
    this: Account,
    type,
    activationDate?,
  ) {
    const verifyTokenExpireDate = new Date(
      Date.now() + Environment.JWT_VERIFY_EXPIRES_IN * 1000,
    );
    const activation = {
      activationDate,
      type,
      verifyTokenExpireDate,
      verifyToken: jwtService.sign(
        {
          id: this._id,
          verifyTokenExpiresTime: verifyTokenExpireDate.toISOString(),
        },
        {
          secret: Environment.JWT_VERIFY_SECRET,
          expiresIn: Environment.JWT_VERIFY_EXPIRES_IN,
        },
      ),
    };
    (this.activations ||= []).push(activation);
    return activation;
  };

  const generateToken = async (account: Account) => {
    const [accessTokenExpiration, refreshTokenExpiration] = [
      DateTime.now().plus({ seconds: Environment.JWT_ACCESS_EXPIRES_IN }),
      DateTime.now().plus({ seconds: Environment.JWT_REFRESH_EXPIRES_IN }),
    ];
    const [accessToken, refreshToken] = await Promise.all([
      jwtService.signAsync(
        account.isGuest
          ? {
              id: account.id,
              preferredLanguage: account.preferences.languages,
              role: AccountRole.Guest,
              showAds: true,
              accessTokenExpiresTime: accessTokenExpiration.toISO(),
            }
          : {
              id: account.id,
              preferredLanguage: account.preferences.languages,
              role: AccountRole.Member,
              showAds: true,
              accessTokenExpiresTime: accessTokenExpiration.toISO(),
            },
        {
          expiresIn: Environment.JWT_ACCESS_EXPIRES_IN,
          secret: Environment.JWT_ACCESS_SECRET,
        },
      ),
      jwtService.signAsync(
        {
          id: account.id,
          accessTokenExpiresTime: refreshTokenExpiration.toISO(),
        },
        {
          expiresIn: Environment.JWT_REFRESH_EXPIRES_IN,
          secret: Environment.JWT_REFRESH_SECRET,
        },
      ),
    ]);

    return {
      accessToken,
      accessTokenExpiration: accessTokenExpiration.toJSDate(),
      refreshToken,
      refreshTokenExpiration: refreshTokenExpiration.toJSDate(),
    };
  };

  AccountSchema.methods.generateToken = async function (
    this: Account,
    payload,
  ) {
    const token = await generateToken(this);
    const credential = this.credentials.find(
      (c) => c.deviceUUID === payload.deviceUUID,
    );

    if (credential) {
      credential.device = payload.device;
      credential.deviceUUID = payload.deviceUUID;
      credential.platform = payload.platform;
      credential.accessToken = token.accessToken;
      credential.accessTokenExpiration = token.accessTokenExpiration;
      credential.refreshToken = token.refreshToken;
      credential.refreshTokenExpiration = token.refreshTokenExpiration;
    } else {
      this.credentials.push({ ...token, ...payload });
    }
    this.markModified('credentials');
    await this.save();

    return { accessToken: token.accessToken, refreshToken: token.refreshToken };
  };

  AccountSchema.methods.regenerateToken = async function (
    this: Account,
    filter,
  ) {
    const credential = this.credentials.find((c) =>
      filter.deviceUUID
        ? c.deviceUUID === filter.deviceUUID
        : filter.accessToken
        ? c.accessToken === filter.accessToken
        : c.refreshToken === filter.refreshToken,
    );

    const token = await generateToken(this);
    credential.accessToken = token.accessToken;
    credential.accessTokenExpiration = token.accessTokenExpiration;
    credential.refreshToken = token.refreshToken;
    credential.refreshTokenExpiration = token.refreshTokenExpiration;
    this.markModified('credentials');
    await this.save();

    return { accessToken: token.accessToken, refreshToken: token.refreshToken };
  };

  return AccountSchema;
};
