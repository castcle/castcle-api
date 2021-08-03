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
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AccountDocument, AccountModel } from '../schemas/account.schema';
import { AccountActivationDocument } from '../schemas/accountActivation.schema';
import { Environment as env } from '@castcle-api/environments';
import * as mongoose from 'mongoose';
import { CreateCredentialDto, CreateAccountDto } from '../dtos/account.dto';
import {
  CredentialDocument,
  CredentialModel
} from '../schemas/credential.schema';
import { Token } from '@castcle-api/utils';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  EmailVerifyToken,
  MemberAccessTokenPayload
} from '../dtos/token.dto';

export interface AccountRequirements {
  header: {
    platform: string;
  };
  device: string;
  deviceUUID: string;
  languagesPreferences: string[];
}

export interface SignupRequirements {
  email: string;
  password: string;
  displayName: string;
  displayId: string;
}

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectModel('Account') public _accountModel: AccountModel,
    @InjectModel('Credential')
    public _credentialModel: CredentialModel,
    @InjectModel('AccountActivation')
    public _accountActivationModel: Model<AccountActivationDocument>
  ) {}

  getCredentialFromDeviceUUID = (deviceUUID: string) =>
    this._credentialModel.findOne({ deviceUUID: deviceUUID }).exec();

  getCredentialFromRefreshToken = (refreshToken: string) =>
    this._credentialModel.findOne({ refreshToken: refreshToken }).exec();

  getCredentialFromAccessToken = (accessToken: string) =>
    this._credentialModel.findOne({ accessToken: accessToken }).exec();

  async createAccount(accountRequirements: AccountRequirements) {
    const newAccount = new this._accountModel({
      isGuest: true,
      preferences: {
        languages: accountRequirements.languagesPreferences
      }
    } as CreateAccountDto);
    const accountDocument = await newAccount.save();
    const accessTokenResult = this._generateAccessToken({
      id: accountDocument._id as string,
      preferredLanguage: accountRequirements.languagesPreferences,
      role: 'guest'
    });
    const refreshTokenResult = this._generateRefreshToken({
      id: accountDocument._id as string,
      role: 'guest'
    });
    const credential = new this._credentialModel({
      account: mongoose.Types.ObjectId(accountDocument._id),
      accessToken: accessTokenResult.accessToken,
      accessTokenExpireDate: accessTokenResult.accessTokenExpireDate,
      refreshToken: refreshTokenResult.refreshToken,
      refreshTokenExpireDate: refreshTokenResult.refreshTokenExpireDate,
      device: accountRequirements.device,
      platform: accountRequirements.header.platform,
      deviceUUID: accountRequirements.deviceUUID
    } as CreateCredentialDto);
    const credentialDocument = await credential.save();
    return { accountDocument, credentialDocument };
  }

  getAccountFromCredential = (credential: CredentialDocument) =>
    this._accountModel.findById(credential.account);

  getAccountFromEmail = (email: string) =>
    this._accountModel.findOne({ email: email });

  _generateAccessToken(payload: AccessTokenPayload) {
    const now = new Date();
    const accessTokenExpireDate = new Date(
      now.getTime() + env.jwt_access_expires_in * 1000
    );
    payload.accessTokenExpiresTime = accessTokenExpireDate.toISOString();
    const accessToken = Token.generateToken(
      payload,
      env.jwt_access_secret,
      Number(env.jwt_access_expires_in)
    );
    return {
      accessToken,
      accessTokenExpireDate
    };
  }

  _generateRefreshToken(payload: RefreshTokenPayload) {
    const now = new Date();
    const refreshTokenExpireDate = new Date(
      now.getTime() + env.jwt_refresh_expires_in * 1000
    );
    payload.refreshTokenExpiresTime = refreshTokenExpireDate.toISOString();
    const refreshToken = Token.generateToken(
      payload,
      env.jwt_refresh_secret,
      Number(env.jwt_refresh_expires_in)
    );

    return {
      refreshToken,
      refreshTokenExpireDate
    };
  }

  _generateEmailVerifyToken(payload: EmailVerifyToken) {
    const now = new Date();
    const emailVerifyTokenExpireDate = new Date(
      now.getTime() + Number(env.jwt_verify_expires_in)
    );
    const emailVerifyToken = Token.generateToken(
      payload,
      env.jwt_verify_secret,
      Number(env.jwt_verify_expires_in)
    );
    return {
      emailVerifyToken,
      emailVerifyTokenExpireDate
    };
  }

  async verifyAccessToken(accessToken: string) {
    const credentialDocument = await this._credentialModel
      .findOne({ accessToken: accessToken })
      .exec();
    if (credentialDocument && credentialDocument.isAccessTokenValid())
      return true;
    else return false;
  }

  async verifyEmailToken(verificationToken: string) {
    this._accountActivationModel.findOne({
      verifyToken: verificationToken
    });
  }

  async signupByEmail(
    account: AccountDocument,
    requirements: SignupRequirements
  ) {
    account.email = requirements.email;
    account.password = requirements.password;
    //create user here

    await account.save();
    return this.createAccountActivation(account, 'email');
  }

  createAccountActivation(account: AccountDocument, type: 'email' | 'phone') {
    const emailTokenResult = this._generateEmailVerifyToken({
      id: account._id
    });
    const accountActivation = new this._accountActivationModel({
      account: account._id,
      type: type,
      verifyToken: emailTokenResult.emailVerifyToken,
      verifyTokenExpireDate: emailTokenResult.emailVerifyTokenExpireDate
    });
    return accountActivation.save();
  }

  revokeAccountActivation(accountActivation: AccountActivationDocument) {
    const emailTokenResult = this._generateEmailVerifyToken({
      id: accountActivation.account as unknown as string
    });
    accountActivation.revocationDate = new Date();
    accountActivation.verifyToken = emailTokenResult.emailVerifyToken;
    accountActivation.verifyTokenExpireDate =
      emailTokenResult.emailVerifyTokenExpireDate;
    return accountActivation.save();
  }
}
