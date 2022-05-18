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
import { CastLogger } from '@castcle-api/logger';
import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioChannel,
  TwilioClient,
  TwilioErrorMessage,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { Password, Token } from '@castcle-api/utils/commons';
import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import {
  AccessTokenPayload,
  CreateCredentialDto,
  EntityVisibility,
  RegisterWithEmailDto,
  RequestOtpByEmailDto,
  SocialConnectDto,
  UserAccessTokenPayload,
} from '../dtos';
import {
  AccountActivationType,
  AccountRequirements,
  OtpObjective,
  OtpTemplateMessage,
  UserType,
} from '../models';
import { Repository } from '../repositories';
import {
  Account,
  AccountAuthenIdType,
  AccountRole,
  Credential,
  User,
} from '../schemas';
import { AnalyticService } from './analytic.service';

@Injectable()
export class AuthenticationServiceV2 {
  private logger = new CastLogger(AuthenticationServiceV2.name);

  constructor(
    private analyticService: AnalyticService,
    private facebookClient: FacebookClient,
    private googleClient: GoogleClient,
    private twilioClient: TwilioClient,
    private twitterClient: TwitterClient,
    private mailer: Mailer,
    private repository: Repository,
  ) {}

  private generateTokenPayload(credential: Credential, user?: User) {
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
    account: Account,
  ) {
    const isSameAccount = String(credential.account._id) === account.id;
    const isLinkedCredential = account.credentials?.some(
      ({ deviceUUID }) => deviceUUID === credential.deviceUUID,
    );

    if (!isSameAccount) {
      await this.repository.deleteAccount({ _id: credential.account._id });
      await credential
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

    if (!isLinkedCredential) {
      await this.repository.updateAccount(
        { _id: account._id },
        {
          $push: {
            credentials: {
              _id: Types.ObjectId(credential._id),
              deviceUUID: credential.deviceUUID,
            },
          },
        },
      );
    }

    return credential;
  }

  private async login(credential: Credential, account: Account) {
    const users = await this.repository.findUsers(
      { accountId: account._id },
      { sort: { updatedAt: -1 } },
    );

    const user = users.find((user) => user.type === UserType.PEOPLE);
    const pages = users.filter((user) => user.type === UserType.PAGE);
    const tokenPayload = this.generateTokenPayload(credential, user);
    const { accessToken, refreshToken } = await credential.renewTokens(
      tokenPayload,
      { id: String(account._id) },
    );

    return {
      accessToken,
      refreshToken,
      profile: await user?.toUserResponseV2({
        passwordNotSet: !account.password,
      }),
      pages: user && pages.map((page) => page.toPageResponseV2()),
    };
  }

  async loginWithEmail(
    credential: Credential,
    email: string,
    password: string,
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
    socialConnectDto: SocialConnectDto & { ip: string; userAgent: string },
  ) {
    const { email, socialId, provider, ip, userAgent, authToken } =
      socialConnectDto;

    if (provider === AccountAuthenIdType.Facebook) {
      const profile = await this.facebookClient.getFacebookProfile(authToken);
      if (socialId !== profile.id) throw CastcleException.INVALID_AUTH_TOKEN;
      socialConnectDto.displayName ||= profile.name;
    } else if (provider === AccountAuthenIdType.Twitter) {
      const [token, secret] = authToken.split('|');
      const profile = await this.twitterClient.verifyCredentials(token, secret);
      if (socialId !== profile.id_str) {
        throw CastcleException.INVALID_AUTH_TOKEN;
      }
      socialConnectDto.displayName ||= profile.name;
    }

    const accountFromSocial = await this.repository.findAccount({
      provider,
      socialId,
    });

    if (accountFromSocial) {
      await this.linkCredentialToAccount(credential, accountFromSocial);
      const login = await this.login(credential, accountFromSocial);
      return { registered: true, ...login };
    }

    if (email) {
      const duplicateAccount = await this.repository.findAccount({ email });
      if (duplicateAccount) {
        const duplicateUser = await this.repository.findUser({
          accountId: duplicateAccount._id,
        });
        const profile = await duplicateUser?.toUserResponseV2();
        throw CastcleException.DUPLICATE_EMAIL_WITH_PAYLOAD(
          profile ? { profile } : null,
        );
      }
    }

    const registration = await this.registerWithSocial(
      credential,
      socialConnectDto,
    );
    await this.analyticService.trackRegistration(ip, userAgent);
    return { registered: false, ...registration };
  }

  async getRefreshToken(refreshToken: string) {
    const credential = await this.repository.findCredential({ refreshToken });
    if (!credential?.isRefreshTokenValid())
      throw CastcleException.INVALID_REFRESH_TOKEN;
    const account = await this.repository.findAccount({
      _id: credential.account._id,
    });
    return this.login(credential, account);
  }

  async registerWithEmail(
    credential: Credential,
    dto: RegisterWithEmailDto & { hostname: string; ip: string },
  ) {
    const [account, emailAlreadyExists, castcleIdAlreadyExists] =
      await Promise.all([
        this.repository.findAccount({ _id: credential.account._id }),
        this.repository.findAccount({ email: dto.email }),
        this.repository.findUser({ _id: dto.castcleId }),
      ]);

    if (!account.isGuest) throw CastcleException.INVALID_ACCESS_TOKEN;
    if (emailAlreadyExists) throw CastcleException.EMAIL_OR_PHONE_IS_EXIST;
    if (castcleIdAlreadyExists) throw CastcleException.USER_ID_IS_EXIST;

    await this.repository.updateCredentials(
      { 'account._id': account._id },
      { isGuest: false },
    );

    account.isGuest = false;
    account.email = dto.email;
    account.password = Password.hash(dto.password);
    const activation = account.createActivation(AccountActivationType.EMAIL);
    await this.updateReferral(account, dto.referral, dto.ip);
    await account.save();
    await this.repository.createUser({
      ownerAccount: account._id,
      displayId: dto.castcleId,
      displayName: dto.displayName,
      type: UserType.PEOPLE,
    });
    await this.analyticService.trackRegistration(dto.ip, account._id);
    await this.mailer.sendRegistrationEmail(
      dto.hostname,
      account.email,
      activation.verifyToken,
    );

    return this.login(credential, account);
  }

  async registerWithSocial(
    credential: Credential,
    { ip, referral, ...registerDto }: SocialConnectDto & { ip: string },
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

    await this.updateReferral(account, referral, ip);
    await account.set({ isGuest: false }).save();
    await this.repository.createUser({
      ownerAccount: account._id,
      displayId:
        registerDto.displayName ||
        `${registerDto.provider}${registerDto.socialId}`,
      displayName:
        registerDto.displayName ||
        `${registerDto.provider}${registerDto.socialId}`,
      type: UserType.PEOPLE,
      profile: {
        overview: registerDto.overview,
        socials: { [registerDto.provider]: registerDto.link },
        images: {
          avatar: registerDto.avatar
            ? await this.repository.createProfileImage(
                account._id,
                registerDto.avatar,
              )
            : null,
          cover: registerDto.cover
            ? await this.repository.createCoverImage(
                account._id,
                registerDto.cover,
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
    ip: string,
  ) {
    const referrer =
      (await this.repository.findUser({ _id: referrerId })) ||
      (await this.analyticService.getReferrer(ip));

    if (!referrer) return;

    account.referralBy = referrer._id;
    await this.repository.updateAccount(
      { _id: referrer._id },
      { $inc: { referralCount: 1 } },
    );
  }

  private createAccountActivation(
    account: Account,
    type: AccountActivationType,
    autoActivateEmail = false,
  ) {
    const now = new Date();
    const verifyTokenExpireDate = new Date(
      now.getTime() + Environment.JWT_VERIFY_EXPIRES_IN * 1000,
    );
    const verifyToken = Token.generateToken(
      {
        _id: account._id,
        verifyTokenExpiresTime: verifyTokenExpireDate.toISOString(),
      },
      Environment.JWT_VERIFY_SECRET,
      Environment.JWT_VERIFY_EXPIRES_IN,
    );

    (account.activations ??= []).push({
      type,
      verifyToken,
      verifyTokenExpireDate,
      activationDate: autoActivateEmail ? now : undefined,
    });
  }

  /**
   * create account from guest user
   * @param {AccountRequirements} requestOption
   * @returns {TokenResponse}
   */
  async guestLogin(requestOption: AccountRequirements) {
    const credentialGuest = await this.repository.findCredential({
      deviceUUID: requestOption.deviceUUID,
      'account.isGuest': true,
    });

    if (credentialGuest) {
      const tokenPayload = this.generateTokenPayload(credentialGuest);
      return await credentialGuest.renewTokens(tokenPayload, {
        id: String(credentialGuest.account._id),
      });
    }

    const session = await this.repository.accountSession();
    session.startTransaction();
    try {
      const account = await this.repository.createAccount(requestOption, {
        session,
      });

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

      const credential = await this.repository.createCredential(
        {
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
        } as CreateCredentialDto,
        {
          session,
        },
      );

      if (!account.credentials) account.credentials = [];
      account.credentials.push({
        _id: Types.ObjectId(credential._id),
        deviceUUID: credential.deviceUUID,
      });

      await account.save({ session });
      await session.commitTransaction();

      return {
        accessToken: credential.accessToken,
        refreshToken: credential.refreshToken,
      };
    } catch (error) {
      await session.abortTransaction();
      throw CastcleException.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * For check if castcle ID is existed
   * @param {string} castcleId
   * @returns user
   */
  getExistedUserFromCastcleId(castcleId: string) {
    return this.repository.findUser({ _id: castcleId });
  }

  /**
   * For check if email is existed
   * @param {string} email
   * @returns account
   */
  getAccountFromEmail(email: string) {
    return this.repository.findAccount({ email });
  }

  async requestOtpByEmail({
    email,
    objective,
    recaptchaToken,
    requestedBy,
    ip,
    source,
    userAgent,
  }: RequestOtpByEmailDto & {
    ip?: string;
    requestedBy: string;
    source?: string;
    userAgent?: string;
  }) {
    if (source.toLowerCase() === 'web') {
      const success = await this.googleClient.verifyRecaptcha(
        recaptchaToken,
        ip,
      );
      if (!success) CastcleException.RECAPTCHA_FAILED;
    }

    const account = await this.repository.findAccount({ email });

    if (!account) throw CastcleException.EMAIL_NOT_FOUND;
    if (
      objective !== OtpObjective.ForgotPassword &&
      (account.id !== String(requestedBy) || account.isGuest)
    ) {
      throw CastcleException.INVALID_ACCESS_TOKEN;
    }

    try {
      const existingOtp = await this.repository.findOtp({
        channel: TwilioChannel.EMAIL,
        objective,
        receiver: email,
        isValid: true,
      });

      if (existingOtp) return existingOtp;

      const user = await this.repository.findUser({ accountId: account._id });
      const { sid } = await this.twilioClient.requestOtp({
        channel: TwilioChannel.EMAIL,
        accountId: account.id,
        userAgent,
        receiver: email,
        config: OtpTemplateMessage.from(objective, user?.displayName),
      });

      return this.repository.createOtp({
        channel: TwilioChannel.EMAIL,
        accountId: account._id,
        objective,
        requestId: requestedBy,
        verified: false,
        receiver: email,
        sid,
        expiryDate: DateTime.now()
          .plus({ minutes: Environment.OTP_EMAIL_EXPIRES_IN })
          .toJSDate(),
      });
    } catch (error) {
      this.logger.error(error, 'requestOtpByEmail');
      if (error.message === TwilioErrorMessage.TOO_MANY_REQUESTS) {
        throw CastcleException.TWILIO_TOO_MANY_REQUESTS;
      } else if (error instanceof CastcleException) {
        throw error;
      } else {
        throw CastcleException.TWILIO_MAX_LIMIT;
      }
    }
  }
}
