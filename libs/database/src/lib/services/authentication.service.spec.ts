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

import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationService } from './authentication.service';
import { Environment } from '@castcle-api/environments';
import { AccountDocument } from '../schemas/account.schema';
import { CredentialDocument } from '../schemas/credential.schema';
import {
  rootMongooseTestModule,
  closeInMongodConnection,
  MongooseForFeatures
} from '../database.module';

//for setup env incase deloy at server
let env: any = Environment;
if (!env)
  env = {
    db_test_in_db: false,
    jwt_refresh_expires_in: 1800,
    jwt_access_expires_in: 600,
    jwt_verify_expires_in: 500
  };

describe('Authentication Service', () => {
  let service: AuthenticationService;
  console.log('test in real db = ', env.db_test_in_db);
  const importModules = env.db_test_in_db
    ? [MongooseModule.forRoot(env.db_uri, env.db_options), MongooseForFeatures]
    : [rootMongooseTestModule(), MongooseForFeatures];
  const providers = [AuthenticationService];
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers
    }).compile();
    service = module.get<AuthenticationService>(AuthenticationService);
  });
  afterAll(async () => {
    if (env.db_test_in_db) await closeInMongodConnection();
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
          preferredLanguage: ['th', 'th'],
          role: 'guest'
        });
        expect(result.accessToken).toBeDefined();
        expect(typeof result.accessToken).toBe('string');
        expect(result.accessTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${env.jwt_access_expires_in} seconds`, () => {
        const now = new Date();
        const expectedExpireDate = new Date(
          now.getTime() + Number(env.jwt_access_expires_in) * 1000
        );
        const result = service._generateAccessToken({
          id: 'randomid',
          preferredLanguage: ['th', 'th'],
          role: 'guest'
        });
        expect(result.accessTokenExpireDate).toEqual(expectedExpireDate);
      });
    });

    describe('#_generateRefreshToken()', () => {
      it('should return  refreshToken and refreshTokenExpireDate', () => {
        const result = service._generateRefreshToken({
          id: 'randomid',
          role: 'guest'
        });
        expect(result.refreshToken).toBeDefined();
        expect(typeof result.refreshToken).toBe('string');
        expect(result.refreshTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${env.jwt_refresh_expires_in} seconds`, () => {
        const now = new Date();
        const expectedExpireDate = new Date(
          now.getTime() + Number(env.jwt_refresh_expires_in) * 1000
        );
        const result = service._generateRefreshToken({
          id: 'randomid',
          role: 'guest'
        });
        expect(result.refreshTokenExpireDate).toEqual(expectedExpireDate);
      });
    });

    describe('#_generateEmailVerifyToken()', () => {
      it('should return  emailVerifyToken and emailVerifyTokenExpireDate', () => {
        const result = service._generateEmailVerifyToken({
          id: 'randomid'
        });
        expect(result.emailVerifyToken).toBeDefined();
        expect(typeof result.emailVerifyToken).toBe('string');
        expect(result.emailVerifyTokenExpireDate).toBeDefined();
      });
      it(`expire date should be in the next ${env.jwt_verify_expires_in} seconds`, () => {
        const now = new Date();
        const expectedExpireDate = new Date(
          now.getTime() + Number(env.jwt_verify_expires_in) * 1000
        );

        const result = service._generateEmailVerifyToken({
          id: 'randomid'
        });
        expect(result.emailVerifyTokenExpireDate).toEqual(expectedExpireDate);
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
        expect(createAccountResult.credentialDocument.account).toEqual(
          createAccountResult.accountDocument._id
        ); //not sure how to  check
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

    describe('#getCredentialFromDeviceUUID', () => {
      it('should return credential document when call a function from newly create Account device UUID', async () => {
        const resultCredential = await service.getCredentialFromDeviceUUID(
          newDeviceUUID
        );
        expect(resultCredential._id).toEqual(
          createAccountResult.credentialDocument._id
        );
      });
      it('should return null if there is not found deviceUUID', async () => {
        const resultCredential = await service.getCredentialFromDeviceUUID(
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
          password: 'sompop',
          isGuest: true,
          preferences: {
            langagues: ['en', 'en']
          }
        });
        const newAccountResult = await newAccount.save();
        const result = await service.getAccountFromEmail(newlyInsertEmail);
        expect(result._id).toEqual(newAccountResult._id);
      });
    });
  });
});
