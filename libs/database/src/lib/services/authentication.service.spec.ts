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
import { TwilioChannel } from '@castcle-api/utils/clients';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  UserService,
} from '../database.module';
import { EntityVisibility } from '../dtos';
import { AuthenticationProvider, OtpObjective, QueueName } from '../models';
import {
  Account,
  AccountActivationV1,
  AccountAuthenId,
  Credential,
  Otp,
  User,
} from '../schemas';
import {
  AuthenticationService,
  SignupRequirements,
  SignupSocialRequirements,
} from './authentication.service';

describe('Authentication Service', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: AuthenticationService;
  let userService: UserService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        AuthenticationService,
        UserService,
        ContentService,
        HashtagService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthenticationService);
    userService = moduleRef.get(UserService);

    jest.spyOn(service, 'embedAuthentication').mockImplementation(async () => {
      console.log('embed authentication.');
    });
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Onboarding', () => {
    let createAccountResult: {
      accountDocument: Account;
      credentialDocument: Credential;
    };
    let accountDocumentCountBefore: number;
    const newDeviceUUID = '83b696d7-320b-4402-a412-d9cee10fc6a3';

    beforeAll(async () => {
      accountDocumentCountBefore = await service._accountModel
        .countDocuments()
        .exec();
      createAccountResult = await service.createAccount({
        device: 'iPhone01',
        deviceUUID: newDeviceUUID,
        languagesPreferences: ['en', 'en'],
        header: {
          platform: 'iOs',
        },
      });
    });

    describe('#_generateAccessToken()', () => {
      it('should return  accessToken, accessTokenExpireDate', () => {
        const result = service._generateAccessToken({
          id: 'randomid',
          role: 'guest',
          showAds: true,
        });
        expect(result.accessToken).toBeDefined();
        expect(typeof result.accessToken).toBe('string');
        expect(result.accessTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${Environment.JWT_ACCESS_EXPIRES_IN} seconds`, () => {
        const result = service._generateAccessToken({
          id: 'randomid',
          role: 'guest',
          showAds: true,
        });
        expect(result.accessTokenExpireDate).toBeDefined();
        //expect(result.accessTokenExpireDate).toEqual(expectedExpireDate);
      });
    });

    describe('#_generateRefreshToken()', () => {
      it('should return  refreshToken and refreshTokenExpireDate', () => {
        const result = service._generateRefreshToken({
          id: 'randomid',
        });
        expect(result.refreshToken).toBeDefined();
        expect(typeof result.refreshToken).toBe('string');
        expect(result.refreshTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${Environment.JWT_REFRESH_EXPIRES_IN} seconds`, () => {
        const result = service._generateRefreshToken({
          id: 'randomid',
        });
        expect(result.refreshTokenExpireDate).toBeDefined();
        //expect(result.refreshTokenExpireDate).toEqual(expectedExpireDate);
      });
    });

    describe('#_generateEmailVerifyToken()', () => {
      it('should return  emailVerifyToken and emailVerifyTokenExpireDate', () => {
        const result = service._generateEmailVerifyToken({
          id: 'randomid',
        });
        expect(result.verifyToken).toBeDefined();
        expect(typeof result.verifyToken).toBe('string');
        expect(result.verifyTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${Environment.JWT_VERIFY_EXPIRES_IN} seconds`, () => {
        const now = new Date();
        const expectedExpireDate = new Date(
          now.getTime() + Environment.JWT_VERIFY_EXPIRES_IN * 1000,
        );

        const result = service._generateEmailVerifyToken({
          id: 'randomid',
        });
        expect(result.verifyTokenExpireDate.getMinutes()).toEqual(
          expectedExpireDate.getMinutes(),
        );
        expect(result.verifyTokenExpireDate.getHours()).toEqual(
          expectedExpireDate.getHours(),
        );
        expect(result.verifyTokenExpireDate.getDay()).toEqual(
          expectedExpireDate.getDay(),
        );
      });
    });

    describe('#createAccount()', () => {
      it('should create a new Account ', async () => {
        expect(createAccountResult.accountDocument).toBeDefined();
        const currentAccountCount = await service._accountModel
          .countDocuments()
          .exec();
        expect(currentAccountCount - accountDocumentCountBefore).toBe(1);
      });
      it('should create a new Credential with account from above', () => {
        expect(createAccountResult.credentialDocument).toBeDefined();
        expect(createAccountResult.credentialDocument.account).toEqual({
          _id: createAccountResult.accountDocument._id,
          isGuest: createAccountResult.accountDocument.isGuest,
          visibility: EntityVisibility.Publish,
          preferences: {
            languages: ['en', 'en'],
          },
        }); //not sure how to  check
      });
      it('should create documents with all required properties', () => {
        //check account
        expect(createAccountResult.accountDocument.isGuest).toBeDefined();
        expect(createAccountResult.accountDocument.preferences).toBeDefined();
        expect(createAccountResult.accountDocument).toBeDefined();
        expect(createAccountResult.accountDocument.updatedAt).toBeDefined();
        expect(createAccountResult.accountDocument.createdAt).toBeDefined();
        //check credential
        expect(
          createAccountResult.credentialDocument.accessToken,
        ).toBeDefined();
        expect(
          createAccountResult.credentialDocument.accessTokenExpireDate,
        ).toBeDefined();
        expect(
          createAccountResult.credentialDocument.refreshToken,
        ).toBeDefined();
        expect(
          createAccountResult.credentialDocument.refreshTokenExpireDate,
        ).toBeDefined();
        expect(createAccountResult.credentialDocument.createdAt).toBeDefined();
        expect(createAccountResult.credentialDocument.updatedAt).toBeDefined();
      });
      it('newly created Account should be guest', () => {
        expect(createAccountResult.accountDocument.isGuest).toBe(true);
      });
      it('should contain all valid tokens', () => {
        console.log(createAccountResult.credentialDocument.account);
        expect(
          createAccountResult.credentialDocument.account.visibility,
        ).toEqual(EntityVisibility.Publish);
        expect(
          createAccountResult.credentialDocument.isAccessTokenValid(),
        ).toBe(true);
        expect(
          createAccountResult.credentialDocument.isRefreshTokenValid(),
        ).toBe(true);
        //}
      });
    });

    describe('#verifyAccessToken()', () => {
      it('should return true if found a credential and that credential access token is valid', async () => {
        //if (env.db_test_in_db) {
        //find a create account credential
        const credentialFromAccessToken = await service._credentialModel
          .findOne({
            accessToken: createAccountResult.credentialDocument.accessToken,
          })
          .exec();
        expect(credentialFromAccessToken).toBeDefined();
        expect(
          await service.verifyAccessToken(
            createAccountResult.credentialDocument.accessToken,
          ),
        ).toEqual(credentialFromAccessToken.isAccessTokenValid());
        expect(
          await service.verifyAccessToken(
            createAccountResult.credentialDocument.accessToken,
          ),
        ).toBe(true);
      });
      it('should return false if credential not found ', async () => {
        const testToken = 'shouldnotexist';
        const credentialFromAccessToken = await service._credentialModel
          .findOne({ accessToken: testToken })
          .exec();
        expect(credentialFromAccessToken).toBeNull();
        expect(await service.verifyAccessToken(testToken)).toBe(false);
      });
    });

    describe('#getGuestCredentialFromDeviceUUID', () => {
      it('should return credential document when call a function from newly create Account device UUID', async () => {
        const resultCredential = await service.getGuestCredentialFromDeviceUUID(
          newDeviceUUID,
        );
        expect(resultCredential._id).toEqual(
          createAccountResult.credentialDocument._id,
        );
      });
      it('should return null if there is not found deviceUUID', async () => {
        const resultCredential = await service.getGuestCredentialFromDeviceUUID(
          'NOPEEE',
        );
        expect(resultCredential).toBeNull();
      });
    });

    describe('#getCredentialFromRefreshToken()', () => {
      it('should return credential with newly create Account refresh token', async () => {
        const resultCredential = await service.getCredentialFromRefreshToken(
          createAccountResult.credentialDocument.refreshToken,
        );
        expect(resultCredential._id).toEqual(
          createAccountResult.credentialDocument._id,
        );
      });
    });

    describe('#getCredentialFromAccessToken()', () => {
      it('should return credential with newly create Account refresh token', async () => {
        const resultCredential = await service.getCredentialFromAccessToken(
          createAccountResult.credentialDocument.accessToken,
        );
        expect(resultCredential._id).toEqual(
          createAccountResult.credentialDocument._id,
        );
      });
    });

    describe('#getExistedUserFromCastcleId', () => {
      let signupResult: AccountActivationV1;
      const signupRequirements: SignupRequirements = {
        displayId: 'people',
        displayName: 'People',
        email: 'sompopdude@dudedude.com',
        password: '2@HelloWorld',
      };
      beforeAll(async () => {
        signupResult = await service.signupByEmail(
          createAccountResult.accountDocument,
          {
            displayId: 'people',
            displayName: 'People',
            email: signupRequirements.email,
            password: signupRequirements.password,
          },
        );
      });
      it('should create an accountActivation', () => {
        expect(signupResult).toBeDefined();
      });
      it('should return exist user is null', async () => {
        const id = 'undefined';
        const findUser = await service.getExistedUserFromCastcleId(id);
        expect(findUser).toBeNull();
      });
      it('should return exist user not null', async () => {
        const id = 'people';
        const findUser = await service.getExistedUserFromCastcleId(id);
        expect(findUser).not.toBeNull();
      });
      it('should set statuses of user all to deleted', async () => {
        const id = 'people';
        const findUser = await service.getExistedUserFromCastcleId(id);
        findUser.visibility = EntityVisibility.Deleted;
        expect(findUser.visibility).toEqual(EntityVisibility.Deleted);
      });
    });

    describe('#getAccountFromEmail()', () => {
      it('should return null for non exist email in account', async () => {
        const testEmail = 'yotest@gmail.com';
        const result = await service.getAccountFromEmail(testEmail);
        expect(result).toBeNull();
      });
      it('should found an account that have email match', async () => {
        const newlyInsertEmail = `${Math.ceil(
          Math.random() * 1000,
        )}@testinsert.com`;
        const newAccount = new service._accountModel({
          email: newlyInsertEmail,
          password: 'sompop2@Hello',
          isGuest: true,
          preferences: {
            languages: ['en', 'en'],
          },
        });
        const newAccountResult = await newAccount.save();
        const result = await service.getAccountFromEmail(newlyInsertEmail);
        expect(result._id).toEqual(newAccountResult._id);
      });
    });

    describe('#createAccountActivation()', () => {
      it('should create account activation with verification token', async () => {
        const accountActivation = await service.createAccountActivation(
          createAccountResult.accountDocument,
          'email',
        );
        expect(accountActivation).toBeDefined();
        expect(accountActivation.verifyToken).toBeDefined();
        expect(accountActivation.verifyTokenExpireDate).toBeDefined();
      });
    });

    describe('#signupByEmail()', () => {
      let signupResult: AccountActivationV1;
      let afterSaveAccount: Account;
      let afterSaveUser: User;
      const signupRequirements: SignupRequirements = {
        displayId: 'dudethisisnew',
        displayName: 'Dudeee',
        email: 'sompopdude@dudedude.com',
        password: '2@HelloWorld',
      };
      beforeAll(async () => {
        signupResult = await service.signupByEmail(
          createAccountResult.accountDocument,
          {
            displayId: 'dudethisisnew',
            displayName: 'Dudeee',
            email: signupRequirements.email,
            password: signupRequirements.password,
          },
        );
        afterSaveAccount = await service._accountModel.findById(
          createAccountResult.accountDocument._id,
        );
        afterSaveUser = await userService.getByIdOrCastcleId('dudethisisnew');
      });

      it('should update email, password of current account', () => {
        expect(afterSaveAccount.email).toBe(signupRequirements.email);
        expect(afterSaveAccount.password).toBeDefined();
      });
      it('should encrypt the password of the new account', () => {
        expect(afterSaveAccount.password !== signupRequirements.password).toBe(
          true,
        );
      });
      it('should create a user ', () => {
        expect(afterSaveUser).toBeDefined();
      });
      it('should create an accountActivation', () => {
        expect(signupResult).toBeDefined();
      });
    });

    describe('#verifyAccount()', () => {
      let accountActivation: AccountActivationV1;
      let beforeVerifyAccount;
      let afterVerifyAccount: Account;
      let afterAccountActivation: AccountActivationV1;
      beforeAll(async () => {
        const tokenResult = service._accountActivationModel.generateVerifyToken(
          {
            id: 'randomId',
          },
        );
        accountActivation = await new service._accountActivationModel({
          account: createAccountResult.accountDocument._id,
          type: 'email',
          verifyToken: tokenResult.verifyToken,
          verifyTokenExpireDate: tokenResult.verifyTokenExpireDate,
        }).save();
        beforeVerifyAccount = { ...accountActivation };
        afterVerifyAccount = await service.verifyAccount(accountActivation);
        afterAccountActivation = await service._accountActivationModel
          .findById(accountActivation._id)
          .exec();
      });
      it('should change status of account from isGuest to false and have activationDate', async () => {
        expect(createAccountResult.accountDocument.isGuest).toBe(false);
        expect(
          createAccountResult.accountDocument.activateDate,
        ).not.toBeDefined();
        expect(afterVerifyAccount.activateDate).toBeDefined();
        const postCredential = await service._credentialModel
          .findById(createAccountResult.credentialDocument._id)
          .exec();
        expect(postCredential.account.isGuest).toBe(false);
        expect(beforeVerifyAccount.activateDate).not.toBeDefined();
        expect(afterVerifyAccount.activateDate).toBeDefined();
      });
      it('should update the accountActivation status', () => {
        expect(beforeVerifyAccount.activationDate).not.toBeDefined();
        expect(afterAccountActivation.activationDate).toBeDefined();
      });
    });

    describe('#revokeAccountActivation()', () => {
      it('should update revocation date and verifyToken after called()', async () => {
        const tokenResult = service._accountActivationModel.generateVerifyToken(
          {
            id: 'randomId',
          },
        );
        const accountActivation = await new service._accountActivationModel({
          account: createAccountResult.accountDocument._id,
          type: 'email',
          verifyToken: tokenResult.verifyToken,
          verifyTokenExpireDate: tokenResult.verifyTokenExpireDate,
        }).save();
        expect(accountActivation.revocationDate).not.toBeDefined();
        const newActivation = await service.revokeAccountActivation(
          accountActivation,
        );
        expect(newActivation.verifyToken).toBeDefined();
        expect(tokenResult.verifyToken).not.toEqual(newActivation.verifyToken);
        expect(newActivation.revocationDate).toBeDefined();
      });
    });

    describe('#linkCredentialToAccount()', () => {
      it('should remove old account from credential and change it to new Account', async () => {
        const randomAcc = await service.createAccount({
          device: 'abc',
          deviceUUID: 'uuid1234',
          header: {
            platform: 'ios',
          },
          languagesPreferences: ['en', 'en'],
        });
        expect(randomAcc.accountDocument._id).not.toEqual(
          createAccountResult.accountDocument._id,
        );
        const newCredential = await service.linkCredentialToAccount(
          randomAcc.credentialDocument,
          createAccountResult.accountDocument,
        );
        expect(newCredential._id).toEqual(randomAcc.credentialDocument._id);
        expect(newCredential.account).toEqual({
          _id: createAccountResult.accountDocument._id,
          isGuest: false,
          visibility: EntityVisibility.Publish,
          preferences: {
            languages: ['en', 'en'],
          },
          activateDate: undefined,
          geolocation: null,
        });
      });
    });

    describe('#suggestCastcleId()', () => {
      it('should suggest a name', async () => {
        const suggestName = await service.suggestCastcleId('Hello Friend');
        expect(suggestName).toEqual('hello_friend');
      });
      it('should suggest a name + totalUser if the id is already exist', async () => {
        const totalUser = await service._userModel.countDocuments();
        const suggestName = await service.suggestCastcleId('Dudethisisnew');
        expect(suggestName).toEqual(`dudethisisnew${totalUser}`);
      });
    });

    describe('#signupBySocial()', () => {
      let signupResult: AccountAuthenId;
      let mockAccountResult: {
        accountDocument: Account;
        credentialDocument: Credential;
      };
      const signupRequirements: SignupSocialRequirements = {
        socialId: '7457356332',
        displayName: 'Dudeee Mock',
        provider: AuthenticationProvider.FACEBOOK,
        avatar: {
          original: 'http://placehold.it/200x200',
        },
        socialToken: 'testtoken',
        socialSecretToken: '',
      };
      beforeAll(async () => {
        mockAccountResult = await service.createAccount({
          device: 'iPhone09',
          deviceUUID: newDeviceUUID,
          languagesPreferences: ['en', 'en'],
          header: {
            platform: 'iOs',
          },
        });
        signupResult = await service.signupBySocial(
          mockAccountResult.accountDocument,
          signupRequirements,
        );
      });
      it('should create user and authen social correctly', async () => {
        const afterSaveUser = await service.getUserFromAccountId(
          mockAccountResult.credentialDocument,
        );
        const accountSocial = await service.getAccountAuthenIdFromSocialId(
          signupRequirements.socialId,
          signupRequirements.provider,
        );

        expect(signupResult).toBeDefined();
        expect(signupRequirements.displayName).toEqual(
          afterSaveUser[0].displayName,
        );
        expect('dudeee_mock').toEqual(afterSaveUser[0].displayId);
        expect(signupRequirements.provider).toEqual(accountSocial.type);
        expect(signupRequirements.socialId).toEqual(accountSocial.socialId);
        expect(signupRequirements.avatar.original).toEqual(
          afterSaveUser[0].profile.images.avatar.original,
        );
        expect(signupRequirements.displayName).toEqual(
          afterSaveUser[0].displayName,
        );
        expect(signupRequirements.socialToken).toEqual('testtoken');
      });
    });

    describe('#createAccountAuthenId()', () => {
      it('should create account authen with new social provider', async () => {
        const socialId = '453455242';
        const result = await service.createAccountAuthenId(
          createAccountResult.accountDocument,
          AuthenticationProvider.TWITTER,
          socialId,
          'testtoken',
          'secret',
        );

        const accountSocial = await service.getAccountAuthenIdFromSocialId(
          socialId,
          AuthenticationProvider.TWITTER,
        );

        expect(result).toBeDefined();
        expect(accountSocial.socialId).toEqual(result.socialId);
        expect(accountSocial.type).toEqual(result.type);
      });
    });

    describe('#getAccountAuthenIdFromSocialId()', () => {
      it('should get social account from provider and social id', async () => {
        const twsocialId = '453455242';
        const fbsocialId = '453457890';
        await service.createAccountAuthenId(
          createAccountResult.accountDocument,
          AuthenticationProvider.FACEBOOK,
          fbsocialId,
          'testtoken',
          '',
        );

        const accountSocialTw = await service.getAccountAuthenIdFromSocialId(
          twsocialId,
          AuthenticationProvider.TWITTER,
        );
        const accountSocialFb = await service.getAccountAuthenIdFromSocialId(
          fbsocialId,
          AuthenticationProvider.FACEBOOK,
        );

        expect(accountSocialTw).toBeDefined();
        expect(accountSocialFb).toBeDefined();
        expect(accountSocialFb.socialId).toEqual(fbsocialId);
        expect(accountSocialTw.socialId).toEqual(twsocialId);
        expect(accountSocialTw.socialToken).toEqual('testtoken');
      });
    });

    describe('#getAccountFromMobile()', () => {
      it('should return null for non exist mobile in account', async () => {
        const result = await service.getAccountFromMobile('812342336', '+66');
        expect(result).toBeNull();
      });
      it('should found an account that have email match', async () => {
        const newlyInsertEmail = `${Math.ceil(
          Math.random() * 1000,
        )}@testinsert.com`;
        const newAccount = new service._accountModel({
          email: newlyInsertEmail,
          password: 'sompop234@Hello',
          mobile: {
            countryCode: '+66',
            number: '0817896767',
          },
          isGuest: true,
          preferences: {
            languages: ['en', 'en'],
          },
        });
        const newAccountResult = await newAccount.save();
        const result = await service.getAccountFromMobile('817896767', '+66');
        expect(result._id).toEqual(newAccountResult._id);
      });
    });

    describe('#Otp Document', () => {
      let account: Account = null;
      const password = 'sompop234@Hello';
      const countryCodeTest = '+66';
      const numberTest = '0817896888';
      let otp: Otp = null;

      beforeAll(async () => {
        const newlyInsertEmail = `${Math.ceil(
          Math.random() * 1000,
        )}@test-insert.com`;
        const newAccount = new service._accountModel({
          email: newlyInsertEmail,
          password: password,
          mobile: {
            countryCode: countryCodeTest,
            number: numberTest,
          },
          isGuest: false,
          preferences: {
            languages: ['en', 'en'],
          },
        });
        account = await newAccount.save();
        otp = await service.generateOtp(
          account,
          OtpObjective.FORGOT_PASSWORD,
          account.id,
          TwilioChannel.EMAIL,
          false,
        );
      });

      it('should generate otp successful', async () => {
        expect(otp.refCode).toBeDefined();
        expect(otp.isValid()).toEqual(true);
      });

      it('should found otp document that match with account and ref code', async () => {
        const result = await service.getOtpFromAccount(account, otp.refCode);
        expect(result).toBeDefined();
      });

      it('should found otp document that match with request id and objective', async () => {
        const result = await service.getAllOtpFromRequestIdObjective(
          account.id,
          OtpObjective.FORGOT_PASSWORD,
        );
        expect(result).toBeDefined();
      });

      it('should found otp document that match with request id and ref code', async () => {
        const result = await service.getOtpFromRequestIdRefCode(
          account.id,
          otp.refCode,
        );
        expect(result).toBeDefined();
      });

      it('should found otp document that match with ref code', async () => {
        const result = await service.getOtpFromRefCode(otp.refCode);
        expect(result).toBeDefined();
      });

      it('should update retry otp document successful', async () => {
        await service.updateRetryOtp(otp);
        const result = await service.getOtpFromRefCode(otp.refCode);
        expect(result.retry).toEqual(1);
      });

      it('should update account password successful', async () => {
        const result = await service.changePassword(
          account,
          otp,
          'test1234@!gbn',
        );
        expect(result).toBeDefined();
      });
    });
  });
  describe('Account Device', () => {
    describe('#createAccountDevice', () => {
      let account: Account;
      beforeAll(async () => {
        account = await new service._accountModel({
          email: 'test@gmail.com',
          password: '11223344a',
          isGuest: true,
          preferences: {
            languages: ['en', 'en'],
          },
        }).save();
      });
      it('should create firebase token on platform ios is exits.', async () => {
        const requestBody = {
          uuid: '196c10cd-2d1d-47a5-9700-3b57e7e34386',
          platform: 'ios',
          firebaseToken: 'testfirebasetokenismock',
        };
        await (service as any).createAccountDevice({
          accountId: account._id,
          ...requestBody,
        });
        const accountDevice = await (service as any)._accountDeviceModel
          .findOne(requestBody)
          .exec();

        expect(requestBody).toBeTruthy();
        expect(requestBody.uuid).toEqual(accountDevice.uuid);
        expect(requestBody.platform).toEqual(accountDevice.platform);
        expect(requestBody.firebaseToken).toEqual(accountDevice.firebaseToken);
      });
      it('should create firebase token on platform android is exits.', async () => {
        const requestBody = {
          uuid: '196c10cd-2d1d-47a5-9700-3b57e7e34386',
          platform: 'android',
          firebaseToken: 'testfirebasetokenismock',
        };
        await (service as any).createAccountDevice({
          accountId: account._id,
          ...requestBody,
        });
        const accountDevice = await (service as any)._accountDeviceModel
          .findOne(requestBody)
          .exec();

        expect(requestBody).toBeTruthy();
        expect(requestBody.uuid).toEqual(accountDevice.uuid);
        expect(requestBody.platform).toEqual(accountDevice.platform);
        expect(requestBody.firebaseToken).toEqual(accountDevice.firebaseToken);
      });
    });
    describe('#deleteAccountDevice', () => {
      let account: Account;
      beforeAll(async () => {
        account = await service._accountModel.findOne({
          email: 'test@gmail.com',
        });
      });

      it('should delete firebase token on platform ios.', async () => {
        const requestBody = {
          uuid: '196c10cd-2d1d-47a5-9700-3b57e7e34386',
          platform: 'ios',
          firebaseToken: 'testfirebasetokenismock',
        };
        await (service as any).deleteAccountDevice({
          accountId: account._id,
          ...requestBody,
        });
        const accountDevice = await (service as any)._accountDeviceModel
          .findOne(requestBody)
          .exec();

        expect(accountDevice).toBeNull();
      });
      it('should delete firebase token on platform android.', async () => {
        const requestBody = {
          uuid: '196c10cd-2d1d-47a5-9700-3b57e7e34386',
          platform: 'android',
          firebaseToken: 'testfirebasetokenismock',
        };
        await (service as any).deleteAccountDevice({
          accountId: account._id,
          ...requestBody,
        });
        const accountDevice = await (service as any)._accountDeviceModel
          .findOne(requestBody)
          .exec();

        expect(accountDevice).toBeNull();
      });
      it('should get account device is not exits.', async () => {
        const accountDevice = await (service as any)._accountDeviceModel
          .find()
          .exec();

        expect(accountDevice).toHaveLength(0);
      });
    });
    afterAll(() => {
      (service as any)._accountDeviceModel.deleteMany({});
    });
  });
});
