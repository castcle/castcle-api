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
import { CastcleName, CastcleRegExp } from '@castcle-api/utils/commons';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Model } from 'mongoose';
import { CreateAccountDto, CreateCredentialDto } from '../dtos/account.dto';
import { CastcleImage, EntityVisibility } from '../dtos/common.dto';
import {
  AccessTokenPayload,
  EmailVerifyToken,
  RefreshTokenPayload,
  UserAccessTokenPayload,
} from '../dtos/token.dto';
import {
  Account,
  AccountActivation,
  AccountActivationModel,
  AccountAuthenId,
  AccountAuthenIdType,
  AccountReferral,
  Credential,
  CredentialModel,
  Otp,
  OtpModel,
  OtpObjective,
  User,
  UserType,
} from '../schemas';
import { UserService } from './user.service';

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
  referral?: string;
}

export interface SignupSocialRequirements {
  displayName: string;
  socialId: string;
  provider: AccountAuthenIdType;
  avatar: CastcleImage;
  socialToken: string;
  socialSecretToken: string;
}

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectModel('Account') public _accountModel: Model<Account>,
    @InjectModel('Credential')
    public _credentialModel: CredentialModel,
    @InjectModel('AccountActivation')
    public _accountActivationModel: AccountActivationModel,
    @InjectModel('User')
    public _userModel: Model<User>,
    @InjectModel('Otp')
    public _otpModel: OtpModel,
    @InjectModel('AccountAuthenId')
    public _accountAuthenId: Model<AccountAuthenId>,
    @InjectModel('AccountReferral')
    public _accountReferral: Model<AccountReferral>,
    private userService: UserService
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
   * @returns {AccountAuthenId}
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
        languages: accountRequirements.languagesPreferences,
      },
      geolocation: accountRequirements.geolocation
        ? accountRequirements.geolocation
        : null,
    } as CreateAccountDto);
    newAccount.visibility = EntityVisibility.Publish;
    const accountDocument = await newAccount.save();
    const accessTokenResult = this._generateAccessToken({
      id: accountDocument._id as string,
      role: 'guest',
      showAds: true,
    });
    const refreshTokenResult = this._generateRefreshToken({
      id: accountDocument._id as string,
    });
    const credential = new this._credentialModel({
      account: {
        _id: mongoose.Types.ObjectId(accountDocument._id),
        isGuest: true,
        preferences: {
          languages: accountRequirements.languagesPreferences,
        },
        visibility: EntityVisibility.Publish,
      },
      accessToken: accessTokenResult.accessToken,
      accessTokenExpireDate: accessTokenResult.accessTokenExpireDate,
      refreshToken: refreshTokenResult.refreshToken,
      refreshTokenExpireDate: refreshTokenResult.refreshTokenExpireDate,
      device: accountRequirements.device,
      platform: accountRequirements.header.platform,
      deviceUUID: accountRequirements.deviceUUID,
    } as CreateCredentialDto);
    const credentialDocument = await credential.save();
    //TODO !!! : how to reduct this
    if (!newAccount.credentials) newAccount.credentials = [];
    newAccount.credentials.push({
      _id: mongoose.Types.ObjectId(credentialDocument._id),
      deviceUUID: credentialDocument.deviceUUID,
    });
    await newAccount.save();
    return { accountDocument, credentialDocument };
  }

  /**
   * should remove account from credential.account and set it's new account to credential.account
   * @param {Credential} credential
   * @param {Account} account
   * @returns {Credential}
   */
  async linkCredentialToAccount(credential: Credential, account: Account) {
    console.log('want to link');
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
      activateDate: account.activateDate, //this to add activateDate to primary account
      geolocation: account.geolocation,
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
                deviceUUID: credential.deviceUUID,
              },
            },
          }
        )
        .exec();
    } else return null; //this should not happen
    credential.markModified('account');
    //set new account credential to current account
    return credential.save();
  }

  /**
   * get account from credential.account._id
   * @param {Credential} credential
   * @returns {Account}
   */
  getAccountFromCredential = (credential: Credential) =>
    this._accountModel.findById(credential.account._id).exec();

  getAccountFromId = (accountId: string) =>
    this._accountModel.findById(accountId).exec();

  getAccountFromEmail = (email: string) => {
    return this._accountModel
      .findOne({
        email: CastcleRegExp.fromString(email),
        visibility: EntityVisibility.Publish,
      })
      .exec();
  };

  /**
   * get and validate account from mobile
   * @param {string} mobileNumber
   * @param {string} countryCode
   * @returns account document
   */
  getAccountFromMobile = (mobileNo: string, countryCode: string) => {
    const mobile = mobileNo.charAt(0) === '0' ? mobileNo.slice(1) : mobileNo;
    return this._accountModel
      .findOne({
        'mobile.countryCode': countryCode,
        'mobile.number': new RegExp(`${mobile}`),
        visibility: EntityVisibility.Publish,
      })
      .exec();
  };

  /**
   *  For check if account is existed
   * @param {string} id
   * @returns {User}
   */
  getExistedUserFromCastcleId = (id: string) => {
    return this._userModel
      .findOne({ displayId: CastcleRegExp.fromString(id) })
      .exec();
  };

  getUserFromAccount = (account: Account) => {
    return this._userModel.findOne({ ownerAccount: account }).exec();
  };

  getUserFromAccountId = (credential: Credential) => {
    return this._userModel
      .find({ ownerAccount: credential.account._id })
      .exec();
  };

  getAccountActivationFromVerifyToken = (token: string) =>
    this._accountActivationModel.findOne({ verifyToken: token }).exec();

  getEmailFromVerifyToken = async (token: string) => {
    const accountActivation = await this._accountActivationModel
      .findOne({ verifyToken: token })
      .populate('account')
      .exec();

    return accountActivation?.account?.email;
  };

  getAccountActivationFromCredential = (credential: Credential) =>
    this._accountActivationModel
      .findOne({ account: credential.account })
      .exec();

  validateEmail = (email: string) => {
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i;
    return re.test(email);
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

  async verifyAccount(accountActivation: AccountActivation) {
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

  async signupByEmail(account: Account, requirements: SignupRequirements) {
    account.isGuest = false;
    //account.email = requirements.email;
    //account.password =  requirements.password;
    await account.changePassword(requirements.password, requirements.email);
    //create user here
    const user = new this._userModel({
      ownerAccount: account._id,
      displayName: requirements.displayName,
      displayId: requirements.displayId, //make sure all id is lower case
      type: UserType.People,
    });
    await user.save();
    const updateAccount = await this.createAccountActivation(account, 'email');

    if (requirements.referral) {
      const refAccount = await this.userService.getByIdOrCastcleId(
        requirements.referral
      );
      const accRef = new this._accountReferral({
        referrerAccount: refAccount ? refAccount.ownerAccount._id : null,
        referrerDisplayId: requirements.referral,
        referringAccount: account._id,
      });
      await accRef.save();
    }
    return updateAccount;
  }

  createAccountActivation(account: Account, type: 'email' | 'phone') {
    const emailTokenResult = this._generateEmailVerifyToken({
      id: account._id,
    });
    const accountActivation = new this._accountActivationModel({
      account: account._id,
      type: type,
      verifyToken: emailTokenResult.verifyToken,
      verifyTokenExpireDate: emailTokenResult.verifyTokenExpireDate,
    });
    return accountActivation.save();
  }

  revokeAccountActivation(accountActivation: AccountActivation) {
    const emailTokenResult = this._generateEmailVerifyToken({
      id: accountActivation.account as unknown as string,
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
    const result = await this.userService.getByIdOrCastcleId(
      name.suggestCastcleId
    );
    if (result) {
      const totalUser = await this._userModel.countDocuments().exec();
      return name.suggestCastcleId + totalUser;
    } else return name.suggestCastcleId;
  }

  /**
   * Update retry count Otp Document
   * @param {Otp} otp
   * @returns {Otp}
   */
  async updateRetryOtp(otp: Otp) {
    const newRetry = (otp.retry ? otp.retry : 0) + 1;
    const otpResult = await this._otpModel
      .updateOne({ _id: otp.id }, { retry: newRetry })
      .exec();
    return otpResult;
  }

  /**
   * generate refCode and create Otp Document
   * @param {Account} account
   * @param {OtpObjective} objective
   * @param {string} requestId
   * @param {string} channel
   * @param {boolean} verify
   * @returns {Otp}
   */
  async generateOtp(
    account: Account,
    objective: OtpObjective,
    requestId: string,
    channel: string,
    verify: boolean,
    reciever?: string,
    sid?: string
  ) {
    const otp = await this._otpModel.generate(
      account._id,
      objective,
      requestId,
      channel,
      verify,
      reciever,
      sid
    );
    return otp;
  }

  /**
   * find Otp from account and refCode
   * @param {Account} account
   * @param {string} refCode
   * @returns {Otp}
   */
  async getOtpFromAccount(account: Account, refCode: string) {
    return this._otpModel
      .findOne({ account: account._id, refCode: refCode })
      .exec();
  }

  /**
   * find all Otp from request id and objective
   * @param {string} requestId
   * @param {OtpObjective} objective
   * @returns {Otp}
   */
  async getAllOtpFromRequestIdObjective(
    requestId: string,
    objective?: OtpObjective
  ) {
    const filter = () => {
      if (objective) return { requestId: requestId, action: objective };
      else return { requestId: requestId };
    };

    return this._otpModel.find(filter).exec();
  }

  /**
   * find Otp from request id and refCode
   * @param {string} requestId
   * @param {string} refCode
   * @returns {Otp}
   */
  async getOtpFromRequestIdRefCode(requestId: string, refCode: string) {
    return this._otpModel
      .findOne({ requestId: requestId, refCode: refCode })
      .exec();
  }

  /**
   * find otp by ref code
   * @param {string} refCode
   * @returns {Otp}
   */
  async getOtpFromRefCode(refCode: string) {
    return this._otpModel.findOne({ refCode: refCode }).exec();
  }

  /**
   * this will assume that we already check otp is valid. this function will change current account password and delete otp then return newly change password account
   * @param {Account} account
   * @param {Otp} otp
   * @param {string} newPassword
   * @returns {Promise<{Account}>}
   */
  async changePassword(account: Account, otp: Otp, newPassword: string) {
    let newAccount: Account;
    const session = await this._accountModel.startSession();
    await session.withTransaction(async () => {
      newAccount = await account.changePassword(newPassword);
      await otp.delete();
    });
    session.endSession();
    return newAccount;
  }

  /**
   * Generate AccessTokenPayload if user is guest. If user has an account will query Users/Pages to create {UserAccessTokenPayload}
   * @param {Credential} credential
   * @returns {AccessTokenPayload | UserAccessTokenPayload}
   */
  async getAccessTokenPayloadFromCredential(credential: Credential) {
    //get account
    //const account = this.getAccountFromCredential(credential);
    if (credential.account.isGuest) {
      return {
        id: credential.account._id,
        preferredLanguage: credential.account.preferences.languages,
        role: credential.account.isGuest ? 'guest' : 'member',
        showAds: true, //TODO !!! need to change this later
      } as AccessTokenPayload;
    } else {
      const user = await this._userModel
        .findOne({
          ownerAccount: credential.account._id,
          type: UserType.People,
          visibility: EntityVisibility.Publish,
        })
        .exec();
      console.debug('mainUser', user);
      const payload = {
        id: credential.account._id,
        role: 'member',
        showAds: true,
        verified: user.verified,
      } as UserAccessTokenPayload;
      console.debug('payload', payload);
      return payload;
    }
  }

  /**
   * create new account from social
   * @param {Account} account
   * @param {SignupSocialRequirements} requirements
   * @returns {AccountAuthenId}
   */
  async signupBySocial(
    account: Account,
    requirements: SignupSocialRequirements
  ) {
    account.isGuest = false;
    await account.save();

    const sugguestDisplayId = await this.suggestCastcleId(
      requirements.displayName
    );

    const user = new this._userModel({
      ownerAccount: account._id,
      displayId: sugguestDisplayId,
      displayName: requirements.displayName,
      type: UserType.People,
      profile: {
        images: {
          avatar: requirements.avatar,
        },
      },
    });
    await user.save();

    return await this.createAccountAuthenId(
      account,
      requirements.provider,
      requirements.socialId,
      requirements.socialToken,
      requirements.socialSecretToken,
      requirements.avatar?.original,
      requirements.displayName
    );
  }

  async updateSocialFlag(account: Account) {
    const user = this._userModel
      .updateOne(
        {
          ownerAccount: account._id,
          type: UserType.People,
          visibility: EntityVisibility.Publish,
        },
        {
          'verified.social': true,
        }
      )
      .exec();
    return user;
  }

  /**
   * create new account from social
   * @param {Account} account
   * @param {AccountAuthenIdType} provider
   * @param {string} socialUserId
   * @param {string} socialUserToken
   * @param {string} socialSecretToken
   * @param {string} avatar
   * @param {string} displayName
   * @returns {AccountAuthenId}
   */
  async createAccountAuthenId(
    account: Account,
    provider: AccountAuthenIdType,
    socialUserId: string,
    socialUserToken?: string,
    socialSecretToken?: string,
    avatar?: string,
    displayName?: string
  ) {
    const accountActivation = new this._accountAuthenId({
      account: account._id,
      type: provider,
      socialId: socialUserId,
      socialToken: socialUserToken,
      socialSecretToken: socialSecretToken,
      avatar: avatar,
      displayName: displayName,
    });
    const result = await accountActivation.save();
    await this.updateSocialFlag(account);
    return result;
  }
}
