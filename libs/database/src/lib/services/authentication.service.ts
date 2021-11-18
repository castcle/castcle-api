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
import { CastcleName } from '@castcle-api/utils';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { CreateAccountDto, CreateCredentialDto } from '../dtos/account.dto';
import { EntityVisibility } from '../dtos/common.dto';
import {
  AccessTokenPayload,
  EmailVerifyToken,
  RefreshTokenPayload,
  UserAccessTokenPayload
} from '../dtos/token.dto';
import { AccountDocument } from '../schemas/account.schema';
import {
  AccountActivationDocument,
  AccountActivationModel
} from '../schemas/accountActivation.schema';
import {
  AccountAuthenIdDocument,
  AccountAuthenIdType
} from '../schemas/accountAuthenId.schema';
import {
  CredentialDocument,
  CredentialModel
} from '../schemas/credential.schema';
import { OtpDocument, OtpModel, OtpObjective } from '../schemas/otp.schema';
import { UserDocument, UserType } from '../schemas/user.schema';

export interface AccountRequirements {
  header: {
    platform: string;
  };
  device: string;
  deviceUUID: string;
  languagesPreferences: string[];
  geolocation?: {
    countryCode: string;
    continentCode: string;
  };
}

export interface SignupRequirements {
  email: string;
  password: string;
  displayName: string;
  displayId: string;
}

export interface SignupSocialRequirements {
  displayName: string;
  socialId: string;
  provider: AccountAuthenIdType;
  avatar: string;
  socialToken: string;
  socialSecretToken: string;
}

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectModel('Account') public _accountModel: Model<AccountDocument>,
    @InjectModel('Credential')
    public _credentialModel: CredentialModel,
    @InjectModel('AccountActivation')
    public _accountActivationModel: AccountActivationModel,
    @InjectModel('User')
    public _userModel: Model<UserDocument>,
    @InjectModel('Otp')
    public _otpModel: OtpModel,
    @InjectModel('AccountAuthenId')
    public _accountAuthenId: Model<AccountAuthenIdDocument>
  ) {}

  getGuestCredentialFromDeviceUUID = (deviceUUID: string) =>
    this._credentialModel
      .findOne({ deviceUUID: deviceUUID, 'account.isGuest': true })
      .exec();

  getCredentialFromRefreshToken = (refreshToken: string) =>
    this._credentialModel.findOne({ refreshToken: refreshToken }).exec();

  getCredentialFromAccessToken = (accessToken: string) =>
    this._credentialModel.findOne({ accessToken: accessToken }).exec();

  /**
   * get account document from social id and social type
   * @param {string} socialUserId social user id
   * @param {AccountAuthenIdType} provider enum social type
   * @returns {AccountAuthenIdDocument}
   */
  getAccountAuthenIdFromSocialId = (
    socialUserId: string,
    provider: AccountAuthenIdType
  ) =>
    this._accountAuthenId
      .findOne({ socialId: socialUserId, type: provider })
      .exec();

  async createAccount(accountRequirements: AccountRequirements) {
    const newAccount = new this._accountModel({
      isGuest: true,
      preferences: {
        languages: accountRequirements.languagesPreferences
      },
      geolocation: accountRequirements.geolocation
        ? accountRequirements.geolocation
        : null
    } as CreateAccountDto);
    newAccount.visibility = EntityVisibility.Publish;
    const accountDocument = await newAccount.save();
    const accessTokenResult = this._generateAccessToken({
      id: accountDocument._id as string,
      role: 'guest',
      showAds: true
    });
    const refreshTokenResult = this._generateRefreshToken({
      id: accountDocument._id as string
    });
    const credential = new this._credentialModel({
      account: {
        _id: mongoose.Types.ObjectId(accountDocument._id),
        isGuest: true,
        preferences: {
          languages: accountRequirements.languagesPreferences
        },
        visibility: EntityVisibility.Publish
      },
      accessToken: accessTokenResult.accessToken,
      accessTokenExpireDate: accessTokenResult.accessTokenExpireDate,
      refreshToken: refreshTokenResult.refreshToken,
      refreshTokenExpireDate: refreshTokenResult.refreshTokenExpireDate,
      device: accountRequirements.device,
      platform: accountRequirements.header.platform,
      deviceUUID: accountRequirements.deviceUUID
    } as CreateCredentialDto);
    const credentialDocument = await credential.save();
    //TODO !!! : how to reduct this
    if (!newAccount.credentials) newAccount.credentials = [];
    newAccount.credentials.push({
      _id: mongoose.Types.ObjectId(credentialDocument._id),
      deviceUUID: credentialDocument.deviceUUID
    });
    await newAccount.save();
    return { accountDocument, credentialDocument };
  }

  /**
   * should remove account from credential.account and set it's new account to credential.account
   * @param {CredentialDocument} credential
   * @param {AccountDocument} account
   * @returns {CredentialDocument}
   */
  async linkCredentialToAccount(
    credential: CredentialDocument,
    account: AccountDocument
  ) {
    console.log('want to link');
    console.log(credential, account);
    if (String(account._id) === String(credential.account._id)) {
      return credential; // already link
    }
    console.log(
      'account not match',
      String(account._id),
      String(credential.account._id)
    );
    //remove account old crdentiial
    await this._accountModel.findByIdAndDelete(credential.account);
    (credential.account as any) = {
      _id: account._id,
      visibility: account.visibility,
      isGuest: account.isGuest,
      preferences: account.preferences,
      activateDate: account.activateDate //this to add activateDate to primary account
    };
    const credentialAccount = await this._accountModel.findById(account._id);
    if (credentialAccount) {
      if (!credentialAccount.credentials) credentialAccount.credentials = [];
      /*credentialAccount.credentials.push({
        _id: mongoose.Types.ObjectId(credential._id),
        deviceUUID: credential.deviceUUID
      });
      await credentialAccount.save();*/
      await this._accountModel
        .updateOne(
          { _id: credentialAccount._id },
          {
            $push: {
              credentials: {
                _id: mongoose.Types.ObjectId(credential._id),
                deviceUUID: credential.deviceUUID
              }
            }
          }
        )
        .exec();
    } else return null; //this should not happen

    //set new account credential to current account
    return credential.save();
  }

  /**
   * get account from credential.account._id
   * @param {CredentialDocument} credential
   * @returns {AccountDocument}
   */
  getAccountFromCredential = (credential: CredentialDocument) =>
    this._accountModel.findById(credential.account._id).exec();

  getAccountFromId = (accountId: string) =>
    this._accountModel.findById(accountId).exec();

  getAccountFromEmail = (email: string) =>
    this._accountModel
      .findOne({ email: email, visibility: EntityVisibility.Publish })
      .exec();

  getAccountFromMobile = (mobileNo: string, countryCode: string) =>
    this._accountModel
      .findOne({
        'mobile.countryCode': countryCode,
        'mobile.number': new RegExp(`${mobileNo}`),
        visibility: EntityVisibility.Publish
      })
      .exec();

  /**
   *  For check if account is existed
   * @param {string} id
   * @returns {UserDocument}
   */
  getExistedUserFromCastcleId = (id: string) => {
    return this._userModel
      .findOne({
        displayId: { $regex: new RegExp('^' + id.toLowerCase() + '$', 'i') }
      })
      .exec();
  };

  /**
   * Get user
   * @param {string} id
   * @returns {UserDocument}
   */
  getUserFromCastcleId = (id: string) => {
    return this._userModel
      .findOne({
        displayId: { $regex: new RegExp('^' + id.toLowerCase() + '$', 'i') },
        visibility: EntityVisibility.Publish
      })
      .exec();
  };

  getUserFromAccountId = (credential: CredentialDocument) => {
    return this._userModel
      .find({ ownerAccount: credential.account._id })
      .exec();
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
    const account = await this._accountModel
      .findById(accountActivation.account)
      .exec();
    account.isGuest = false;
    account.activateDate = now;
    const savedAccount = await account.save();
    return savedAccount;
  }

  async signupByEmail(
    account: AccountDocument,
    requirements: SignupRequirements
  ) {
    account.isGuest = false;
    //account.email = requirements.email;
    //account.password =  requirements.password;
    await account.changePassword(requirements.password, requirements.email);
    //create user here
    const user = new this._userModel({
      ownerAccount: account._id,
      displayName: requirements.displayName,
      displayId: requirements.displayId, //make sure all id is lower case
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

  /**
   *
   * @param {string} displayName this will show suggestName + totalUser(if suggestName is already exist)
   * @returns {Promise<string>} suggestCastCleId
   */
  async suggestCastcleId(displayName: string) {
    const name = new CastcleName(displayName);
    const result = await this.getUserFromCastcleId(name.suggestCastcleId);
    if (result) {
      const totalUser = await this._userModel.countDocuments().exec();
      return name.suggestCastcleId + totalUser;
    } else return name.suggestCastcleId;
  }

  /**
   * Update retry count Otp Document
   * @param {OtpDocument} otp
   * @returns {OtpDocument}
   */
  async updateRetryOtp(otp: OtpDocument) {
    const newRetry = (otp.retry ? otp.retry : 0) + 1;
    const otpResult = await this._otpModel
      .updateOne({ _id: otp.id }, { retry: newRetry })
      .exec();
    return otpResult;
  }

  /**
   * generate refCode and create Otp Document
   * @param {AccountDocument} account
   * @param {OtpObjective} objective
   * @param {string} requestId
   * @returns {OtpDocument}
   */
  async generateOtp(
    account: AccountDocument,
    objective: OtpObjective,
    requestId: string,
    channel: string
  ) {
    const otp = await this._otpModel.generate(
      account._id,
      objective,
      requestId,
      channel
    );
    return otp;
  }

  /**
   * find Otp from account and refCode
   * @param {AccountDocument} account
   * @param {string} refCode
   * @returns {OtpDocument}
   */
  async getOtpFromAccount(account: AccountDocument, refCode: string) {
    return this._otpModel
      .findOne({ account: account._id, refCode: refCode })
      .exec();
  }

  /**
   * find all Otp from request id and objective
   * @param {string} requestId
   * @param {OtpObjective} objective
   * @returns {OtpDocument}
   */
  async getAllOtpFromRequestIdObjective(
    requestId: string,
    objective: OtpObjective
  ) {
    return this._otpModel
      .find({ requestId: requestId, action: objective })
      .exec();
  }

  /**
   * find Otp from request id and refCode
   * @param {string} requestId
   * @param {string} refCode
   * @returns {OtpDocument}
   */
  async getOtpFromRequestIdRefCode(requestId: string, refCode: string) {
    return this._otpModel
      .findOne({ requestId: requestId, refCode: refCode })
      .exec();
  }

  /**
   * find otp by ref code
   * @param {string} refCode
   * @returns {OtpDocument}
   */
  async getOtpFromRefCode(refCode: string) {
    return this._otpModel.findOne({ refCode: refCode }).exec();
  }

  /**
   * this will assume that we already check otp is valid. this function will change current account password and delete otp then return newly change password account
   * @param {AccountDocument} account
   * @param {OtpDocument} otp
   * @param {string} newPassword
   * @returns {Promise<{AccountDocument}>}
   */
  async changePassword(
    account: AccountDocument,
    otp: OtpDocument,
    newPassword: string
  ) {
    let newAccount: AccountDocument;
    const session = await this._accountModel.startSession();
    session.withTransaction(async () => {
      newAccount = await account.changePassword(newPassword);
      await otp.delete();
    });
    session.endSession();
    return newAccount;
  }

  /**
   * Generate AccessTokenPayload if user is guest. If user has an account will query Users/Pages to create {UserAccessTokenPayload}
   * @param {CredentialDocument} credential
   * @returns {AccessTokenPayload | UserAccessTokenPayload}
   */
  async getAccessTokenPayloadFromCredential(credential: CredentialDocument) {
    //get account
    //const account = this.getAccountFromCredential(credential);
    if (credential.account.isGuest) {
      return {
        id: credential.account._id,
        preferredLanguage: credential.account.preferences.langagues,
        role: credential.account.isGuest ? 'guest' : 'member',
        showAds: true //TODO !!! need to change this later
      } as AccessTokenPayload;
    } else {
      const user = await this._userModel
        .findOne({
          ownerAccount: credential.account._id,
          type: UserType.People,
          visibility: EntityVisibility.Publish
        })
        .exec();
      console.debug('mainUser', user);
      const payload = {
        id: credential.account._id,
        role: 'member',
        showAds: true,
        verified: user.verified
      } as UserAccessTokenPayload;
      console.debug('payload', payload);
      return payload;
    }
  }

  /**
   * create new account from social
   * @param {AccountDocument} account
   * @param {SignupSocialRequirements} requirements
   * @returns {AccountAuthenIdDocument}
   */
  async signupBySocial(
    account: AccountDocument,
    requirements: SignupSocialRequirements
  ) {
    account.isGuest = false;
    await account.save();

    const user = new this._userModel({
      ownerAccount: account._id,
      displayId: requirements.socialId,
      displayName: requirements.displayName,
      type: UserType.People,
      profile: {
        images: {
          avatar: {
            original: requirements.avatar
          }
        }
      }
    });
    await user.save();
    return this.createAccountAuthenId(
      account,
      requirements.provider,
      requirements.socialId,
      requirements.socialToken,
      requirements.socialSecretToken
    );
  }

  /**
   * create new account from social
   * @param {AccountDocument} account
   * @param {AccountAuthenIdType} provider
   * @param {string} socialUserId
   * @param {string} socialUserToken
   * @returns {AccountAuthenIdDocument}
   */
  createAccountAuthenId(
    account: AccountDocument,
    provider: AccountAuthenIdType,
    socialUserId: string,
    socialUserToken: string,
    socialSecretToken: string
  ) {
    const accountActivation = new this._accountAuthenId({
      account: account._id,
      type: provider,
      socialId: socialUserId,
      socialToken: socialUserToken,
      socialSecretToken: socialSecretToken
    });
    return accountActivation.save();
  }
}
