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
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import { EntityVisibility } from '../dtos/common.dto';
import { env } from '../environment';
import { AccountAuthenIdDocument, OtpDocument, OtpObjective } from '../schemas';
import { AccountDocument } from '../schemas/account.schema';
import { AccountActivationDocument } from '../schemas/accountActivation.schema';
import { AccountAuthenIdType } from '../schemas/accountAuthenId.schema';
import { CredentialDocument } from '../schemas/credential.schema';
import { UserDocument } from '../schemas/user.schema';
import {
  AuthenticationService,
  SignupRequirements,
  SignupSocialRequirements
} from './authentication.service';

let mongod: MongoMemoryServer;
const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongod = await MongoMemoryServer.create();
      const mongoUri = mongod.getUri();
      return {
        uri: mongoUri,
        ...options
      };
    }
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('Authentication Service', () => {
  let service: AuthenticationService;
  console.log('test in real db = ', env.DB_TEST_IN_DB);
  const importModules = env.DB_TEST_IN_DB
    ? [
        MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS),
        MongooseAsyncFeatures,
        MongooseForFeatures
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [AuthenticationService];
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers
    }).compile();
    service = module.get<AuthenticationService>(AuthenticationService);
  });
  afterAll(async () => {
    if (env.DB_TEST_IN_DB) await closeInMongodConnection();
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('Onboarding', () => {
    let createAccountResult: {
      accountDocument: AccountDocument;
      credentialDocument: CredentialDocument;
    };
    let accountDocumentCountBefore: number;
    let credentialDocumentCountBefore: number;
    const newDeviceUUID = '83b696d7-320b-4402-a412-d9cee10fc6a3';
    beforeAll(async () => {
      accountDocumentCountBefore = await service._accountModel
        .countDocuments()
        .exec();
      credentialDocumentCountBefore = await service._credentialModel
        .countDocuments()
        .exec();
      createAccountResult = await service.createAccount({
        device: 'iPhone01',
        deviceUUID: newDeviceUUID,
        languagesPreferences: ['en', 'en'],
        header: {
          platform: 'iOs'
        }
      });
    });

    describe('#_generateAccessToken()', () => {
      it('should return  accessToken, accessTokenExpireDate', () => {
        const result = service._generateAccessToken({
          id: 'randomid',
          role: 'guest',
          showAds: true
        });
        expect(result.accessToken).toBeDefined();
        expect(typeof result.accessToken).toBe('string');
        expect(result.accessTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${env.JWT_ACCESS_EXPIRES_IN} seconds`, () => {
        const now = new Date();
        const expectedExpireDate = new Date(
          now.getTime() + Number(env.JWT_ACCESS_EXPIRES_IN) * 1000
        );
        const result = service._generateAccessToken({
          id: 'randomid',
          role: 'guest',
          showAds: true
        });
        expect(result.accessTokenExpireDate).toBeDefined();
        //expect(result.accessTokenExpireDate).toEqual(expectedExpireDate);
      });
    });

    describe('#_generateRefreshToken()', () => {
      it('should return  refreshToken and refreshTokenExpireDate', () => {
        const result = service._generateRefreshToken({
          id: 'randomid'
        });
        expect(result.refreshToken).toBeDefined();
        expect(typeof result.refreshToken).toBe('string');
        expect(result.refreshTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${env.JWT_REFRESH_EXPIRES_IN} seconds`, () => {
        const now = new Date();
        const expectedExpireDate = new Date(
          now.getTime() + Number(env.JWT_REFRESH_EXPIRES_IN) * 1000
        );
        const result = service._generateRefreshToken({
          id: 'randomid'
        });
        expect(result.refreshTokenExpireDate).toBeDefined();
        //expect(result.refreshTokenExpireDate).toEqual(expectedExpireDate);
      });
    });

    describe('#_generateEmailVerifyToken()', () => {
      it('should return  emailVerifyToken and emailVerifyTokenExpireDate', () => {
        const result = service._generateEmailVerifyToken({
          id: 'randomid'
        });
        expect(result.verifyToken).toBeDefined();
        expect(typeof result.verifyToken).toBe('string');
        expect(result.verifyTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${env.JWT_VERIFY_EXPIRES_IN} seconds`, () => {
        const now = new Date();
        const expectedExpireDate = new Date(
          now.getTime() + Number(env.JWT_VERIFY_EXPIRES_IN) * 1000
        );

        const result = service._generateEmailVerifyToken({
          id: 'randomid'
        });
        expect(result.verifyTokenExpireDate.getMinutes()).toEqual(
          expectedExpireDate.getMinutes()
        );
        expect(result.verifyTokenExpireDate.getHours()).toEqual(
          expectedExpireDate.getHours()
        );
        expect(result.verifyTokenExpireDate.getDay()).toEqual(
          expectedExpireDate.getDay()
        );
      });
    });

    describe('#createAccount()', () => {
      it('should create a new Account ', async () => {
        expect(createAccountResult.accountDocument).toBeDefined();
        const currentAccountDocumentCount = await service._accountModel
          .countDocuments()
          .exec();
        expect(currentAccountDocumentCount - accountDocumentCountBefore).toBe(
          1
        );
      });
      it('should create a new Credential with account from above', () => {
        expect(createAccountResult.credentialDocument).toBeDefined();
        expect(createAccountResult.credentialDocument.account).toEqual({
          _id: createAccountResult.accountDocument._id,
          isGuest: createAccountResult.accountDocument.isGuest,
          visibility: EntityVisibility.Publish,
          preferences: {
            languages: ['en', 'en']
          }
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
          createAccountResult.credentialDocument.accessToken
        ).toBeDefined();
        expect(
          createAccountResult.credentialDocument.accessTokenExpireDate
        ).toBeDefined();
        expect(
          createAccountResult.credentialDocument.refreshToken
        ).toBeDefined();
        expect(
          createAccountResult.credentialDocument.refreshTokenExpireDate
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
          createAccountResult.credentialDocument.account.visibility
        ).toEqual(EntityVisibility.Publish);
        expect(
          createAccountResult.credentialDocument.isAccessTokenValid()
        ).toBe(true);
        expect(
          createAccountResult.credentialDocument.isRefreshTokenValid()
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
            accessToken: createAccountResult.credentialDocument.accessToken
          })
          .exec();
        expect(credentialFromAccessToken).toBeDefined();
        expect(
          await service.verifyAccessToken(
            createAccountResult.credentialDocument.accessToken
          )
        ).toEqual(credentialFromAccessToken.isAccessTokenValid());
        expect(
          await service.verifyAccessToken(
            createAccountResult.credentialDocument.accessToken
          )
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
          newDeviceUUID
        );
        expect(resultCredential._id).toEqual(
          createAccountResult.credentialDocument._id
        );
      });
      it('should return null if there is not found deviceUUID', async () => {
        const resultCredential = await service.getGuestCredentialFromDeviceUUID(
          'NOPEEE'
        );
        expect(resultCredential).toBeNull();
      });
    });

    describe('#getCredentialFromRefreshToken()', () => {
      it('should return credential with newly create Account refresh token', async () => {
        const resultCredential = await service.getCredentialFromRefreshToken(
          createAccountResult.credentialDocument.refreshToken
        );
        expect(resultCredential._id).toEqual(
          createAccountResult.credentialDocument._id
        );
      });
    });

    describe('#getCredentialFromAccessToken()', () => {
      it('should return credential with newly create Account refresh token', async () => {
        const resultCredential = await service.getCredentialFromAccessToken(
          createAccountResult.credentialDocument.accessToken
        );
        expect(resultCredential._id).toEqual(
          createAccountResult.credentialDocument._id
        );
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
          Math.random() * 1000
        )}@testinsert.com`;
        const newAccount = new service._accountModel({
          email: newlyInsertEmail,
          password: 'sompop2@Hello',
          isGuest: true,
          preferences: {
            languages: ['en', 'en']
          }
        });
        const newAccountResult = await newAccount.save();
        const result = await service.getAccountFromEmail(newlyInsertEmail);
        expect(result._id).toEqual(newAccountResult._id);
      });
    });

    describe('#getUserFromId()', () => {
      it('should return null if non id is exist in user', async () => {
        const result = await service.getUserFromCastcleId('notFoundId');
        expect(result).toBeNull();
      });
      it('should return an user when id is match', async () => {
        const newUser = new service._userModel({
          displayId: 'testNew',
          displayName: 'testName',
          type: 'people',
          ownerAccount: createAccountResult.accountDocument._id
        });
        await newUser.save();
        const result = await service.getUserFromCastcleId('testNew');
        expect(result).not.toBeNull();
        expect(result.displayId).toEqual(newUser.displayId);

        expect(result.displayName).toEqual(newUser.displayName);
      });
    });

    describe('#createAccountActivation()', () => {
      it('should create account activation with verification token', async () => {
        const accountActivation = await service.createAccountActivation(
          createAccountResult.accountDocument,
          'email'
        );
        expect(accountActivation).toBeDefined();
        expect(accountActivation.verifyToken).toBeDefined();
        expect(accountActivation.verifyTokenExpireDate).toBeDefined();
      });
    });

    describe('#signupByEmail()', () => {
      let signupResult: AccountActivationDocument;
      let afterSaveAccount: AccountDocument;
      let afterSaveUser: UserDocument;
      const signupRequirements: SignupRequirements = {
        displayId: 'dudethisisnew',
        displayName: 'Dudeee',
        email: 'sompopdude@dudedude.com',
        password: '2@HelloWorld'
      };
      beforeAll(async () => {
        signupResult = await service.signupByEmail(
          createAccountResult.accountDocument,
          {
            displayId: 'dudethisisnew',
            displayName: 'Dudeee',
            email: signupRequirements.email,
            password: signupRequirements.password
          }
        );
        afterSaveAccount = await service._accountModel.findById(
          createAccountResult.accountDocument._id
        );
        afterSaveUser = await service.getUserFromCastcleId('dudethisisnew');
      });
      it('should update email, password of current account', () => {
        expect(afterSaveAccount.email).toBe(signupRequirements.email);
        expect(afterSaveAccount.password).toBeDefined();
      });
      it('should encrypt the password of the new account', () => {
        expect(afterSaveAccount.password !== signupRequirements.password).toBe(
          true
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
      let accountActivation: AccountActivationDocument;
      let beforeVerifyAccount;
      let afterVerifyAccount: AccountDocument;
      let afterAccountActivation: AccountActivationDocument;
      beforeAll(async () => {
        const tokenResult = service._accountActivationModel.generateVerifyToken(
          {
            id: 'randomId'
          }
        );
        accountActivation = await new service._accountActivationModel({
          account: createAccountResult.accountDocument._id,
          type: 'email',
          verifyToken: tokenResult.verifyToken,
          verifyTokenExpireDate: tokenResult.verifyTokenExpireDate
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
          createAccountResult.accountDocument.activateDate
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
            id: 'randomId'
          }
        );
        const accountActivation = await new service._accountActivationModel({
          account: createAccountResult.accountDocument._id,
          type: 'email',
          verifyToken: tokenResult.verifyToken,
          verifyTokenExpireDate: tokenResult.verifyTokenExpireDate
        }).save();
        expect(accountActivation.revocationDate).not.toBeDefined();
        const newActivation = await service.revokeAccountActivation(
          accountActivation
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
            platform: 'ios'
          },
          languagesPreferences: ['en', 'en']
        });
        expect(randomAcc.accountDocument._id).not.toEqual(
          createAccountResult.accountDocument._id
        );
        const newCredential = await service.linkCredentialToAccount(
          randomAcc.credentialDocument,
          createAccountResult.accountDocument
        );
        expect(newCredential._id).toEqual(randomAcc.credentialDocument._id);
        expect(newCredential.account).toEqual({
          _id: createAccountResult.accountDocument._id,
          isGuest: false,
          visibility: EntityVisibility.Publish,
          preferences: {
            languages: ['en', 'en']
          },
          activateDate: undefined,
          geolocation: null
        });
      });
    });

    describe('#suggestCastcleId()', () => {
      it('should suggest a name', async () => {
        const suggestName = await service.suggestCastcleId('Hello Friend');
        expect(suggestName).toEqual('hellofriend');
      });
      it('should suggest a name + totalUser if the id is already exist', async () => {
        const totalUser = await service._accountModel.countDocuments();
        const suggestName = await service.suggestCastcleId('Dude this is new');
        expect(suggestName).toEqual(`dudethisisnew${totalUser}`);
      });
    });

    describe('#signupBySocial()', () => {
      let signupResult: AccountAuthenIdDocument;
      let mockAccountResult: {
        accountDocument: AccountDocument;
        credentialDocument: CredentialDocument;
      };
      const signupRequirements: SignupSocialRequirements = {
        socialId: '7457356332',
        displayName: 'Dudeee Mock',
        provider: AccountAuthenIdType.Facebook,
        avatar: '/image/test.jpg',
        socialToken: 'testtoken',
        socialSecretToken: ''
      };
      beforeAll(async () => {
        mockAccountResult = await service.createAccount({
          device: 'iPhone09',
          deviceUUID: newDeviceUUID,
          languagesPreferences: ['en', 'en'],
          header: {
            platform: 'iOs'
          }
        });
        signupResult = await service.signupBySocial(
          mockAccountResult.accountDocument,
          signupRequirements
        );
      });
      it('should create user and authen social correctly', async () => {
        const afterSaveUser = await service.getUserFromAccountId(
          mockAccountResult.credentialDocument
        );
        const accountSocial = await service.getAccountAuthenIdFromSocialId(
          signupRequirements.socialId,
          signupRequirements.provider
        );

        expect(signupResult).toBeDefined();
        expect(signupRequirements.displayName).toEqual(
          afterSaveUser[0].displayName
        );
        expect('dudeeemock').toEqual(afterSaveUser[0].displayId);
        expect(signupRequirements.provider).toEqual(accountSocial.type);
        expect(signupRequirements.socialId).toEqual(accountSocial.socialId);
        expect({
          original: signupRequirements.avatar
        }).toEqual(afterSaveUser[0].profile.images.avatar);
        expect(signupRequirements.displayName).toEqual(
          afterSaveUser[0].displayName
        );
        expect(signupRequirements.socialToken).toEqual('testtoken');
      });
    });

    describe('#createAccountAuthenId()', () => {
      it('should create account authen with new social provider', async () => {
        const socialId = '453455242';
        const result = await service.createAccountAuthenId(
          createAccountResult.accountDocument,
          AccountAuthenIdType.Twitter,
          socialId,
          'testtoken',
          'secret'
        );

        const accountSocial = await service.getAccountAuthenIdFromSocialId(
          socialId,
          AccountAuthenIdType.Twitter
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
        const result = await service.createAccountAuthenId(
          createAccountResult.accountDocument,
          AccountAuthenIdType.Facebook,
          fbsocialId,
          'testtoken',
          ''
        );

        const accountSocialTw = await service.getAccountAuthenIdFromSocialId(
          twsocialId,
          AccountAuthenIdType.Twitter
        );
        const accountSocialFb = await service.getAccountAuthenIdFromSocialId(
          fbsocialId,
          AccountAuthenIdType.Facebook
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
          Math.random() * 1000
        )}@testinsert.com`;
        const newAccount = new service._accountModel({
          email: newlyInsertEmail,
          password: 'sompop234@Hello',
          mobile: {
            countryCode: '+66',
            number: '0817896767'
          },
          isGuest: true,
          preferences: {
            languages: ['en', 'en']
          }
        });
        const newAccountResult = await newAccount.save();
        const result = await service.getAccountFromMobile('817896767', '+66');
        expect(result._id).toEqual(newAccountResult._id);
      });
    });

    describe('#Otp Document', () => {
      let account: AccountDocument = null;
      const password = 'sompop234@Hello';
      const countryCodeTest = '+66';
      const numberTest = '0817896888';
      let otp: OtpDocument = null;
      beforeAll(async () => {
        const newlyInsertEmail = `${Math.ceil(
          Math.random() * 1000
        )}@testinsert.com`;
        const newAccount = new service._accountModel({
          email: newlyInsertEmail,
          password: password,
          mobile: {
            countryCode: countryCodeTest,
            number: numberTest
          },
          isGuest: false,
          preferences: {
            languages: ['en', 'en']
          }
        });
        account = await newAccount.save();
      });

      it('should generate otp successful', async () => {
        otp = await service.generateOtp(
          account,
          OtpObjective.ForgotPassword,
          account.id,
          'email',
          false
        );
        expect(otp.refCode).toBeDefined;
        expect(otp.isValid()).toEqual(true);
      });
      it('should found otp document that match with account and ref code', async () => {
        const result = await service.getOtpFromAccount(account, otp.refCode);
        expect(result).toBeDefined;
      });
      it('should found otp document that match with request id and objective', async () => {
        const result = await service.getAllOtpFromRequestIdObjective(
          account.id,
          OtpObjective.ForgotPassword
        );
        expect(result).toBeDefined;
      });
      it('should found otp document that match with request id and ref code', async () => {
        const result = await service.getOtpFromRequestIdRefCode(
          account.id,
          otp.refCode
        );
        expect(result).toBeDefined;
      });
      it('should found otp document that match with ref code', async () => {
        const result = await service.getOtpFromRefCode(otp.refCode);
        expect(result).toBeDefined;
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
          'test1234@!gbn'
        );
        expect(result).toBeDefined;
      });
    });
  });
});
