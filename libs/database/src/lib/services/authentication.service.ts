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
import {
  AccountActivationDocument,
  AccountActivationModel
} from '../schemas/accountActivation.schema';
import { UserDocument, UserType } from '../schemas/user.schema';
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
    public _accountActivationModel: AccountActivationModel,
    @InjectModel('User')
    public _userModel: Model<UserDocument>
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

  async linkCredentialToAccount(
    credential: CredentialDocument,
    account: AccountDocument
  ) {
    //remove account old crdentiial
    await this._accountModel.findByIdAndDelete(credential.account);
    credential.account = account._id;
    //set new account credential to current account
    return credential.save();
  }

  getAccountFromCredential = (credential: CredentialDocument) =>
    this._accountModel.findById(credential.account).exec();

  getAccountFromEmail = (email: string) =>
    this._accountModel.findOne({ email: email }).exec();

  getUserFromId = (id: string) => {
    console.log('finding', id);
    return this._userModel.findOne({ displayId: id }).exec();
  };

  getAccountActivationFromVerifyToken = (token: string) =>
    this._accountActivationModel.findOne({ verifyToken: token }).exec();

  getAccountActivationFromCredential = (credential: CredentialDocument) =>
    this._accountActivationModel
      .findOne({ account: credential.account })
      .exec();

  validateEmail = (email: string) => {
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email.toLowerCase());
  };

  _generateAccessToken = (payload: AccessTokenPayload) =>
    this._credentialModel.generateAccessToken(payload);
  _generateRefreshToken = (payload: RefreshTokenPayload) =>
    this._credentialModel.generateRefreshToken(payload);
  _generateEmailVerifyToken = (payload: EmailVerifyToken) =>
    this._accountActivationModel.generateVerifyToken(payload);

  async verifyAccessToken(accessToken: string) {
    const credentialDocument = await this._credentialModel
      .findOne({ accessToken: accessToken })
      .exec();
    if (credentialDocument && credentialDocument.isAccessTokenValid())
      return true;
    else return false;
  }

  async verifyAccount(accountActivation: AccountActivationDocument) {
    const now = new Date();
    accountActivation.activationDate = now;
    await accountActivation.save();
    //update ac
    const account = await this._accountModel.findById(
      accountActivation.account
    );
    account.isGuest = false;
    account.activateDate = now;
    return account.save();
  }

  async signupByEmail(
    account: AccountDocument,
    requirements: SignupRequirements
  ) {
    //account.email = requirements.email;
    //account.password =  requirements.password;
    await account.changePassword(requirements.password, requirements.email);
    //create user here
    const user = new this._userModel({
      ownerAccount: account._id,
      displayName: requirements.displayName,
      displayId: requirements.displayId,
      type: UserType.People
    });
    await user.save();
    return this.createAccountActivation(account, 'email');
  }

  createAccountActivation(account: AccountDocument, type: 'email' | 'phone') {
    const emailTokenResult = this._generateEmailVerifyToken({
      id: account._id
    });
    const accountActivation = new this._accountActivationModel({
      account: account._id,
      type: type,
      verifyToken: emailTokenResult.verifyToken,
      verifyTokenExpireDate: emailTokenResult.verifyTokenExpireDate
    });
    return accountActivation.save();
  }

  revokeAccountActivation(accountActivation: AccountActivationDocument) {
    const emailTokenResult = this._generateEmailVerifyToken({
      id: accountActivation.account as unknown as string
    });
    accountActivation.revocationDate = new Date();
    accountActivation.verifyToken = emailTokenResult.verifyToken;
    accountActivation.verifyTokenExpireDate =
      emailTokenResult.verifyTokenExpireDate;
    return accountActivation.save();
  }
}
