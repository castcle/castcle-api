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
import {
  MongooseForFeatures,
  MongooseAsyncFeatures
} from '@castcle-api/database';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { AuthenticationService } from '@castcle-api/database';
import { AuthenticationController } from './app.controller';
import { AppService } from './app.service';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { TokenResponse } from './dtos/dto';
import { CredentialDocument } from '@castcle-api/database/schemas';
import { ExportContext } from 'twilio/lib/rest/bulkexports/v1/export';

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

describe('AppController', () => {
  let app: TestingModule;
  let appController: AuthenticationController;
  let service: AuthenticationService;
  let appService: AppService;
  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures
      ],
      controllers: [AuthenticationController],
      providers: [AppService, AuthenticationService]
    }).compile();
    service = app.get<AuthenticationService>(AuthenticationService);
    appService = app.get<AppService>(AppService);
    jest
      .spyOn(appService, 'sendRegistrationEmail')
      .mockImplementation(async () => console.log('send email from mock'));
  });
  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('getData', () => {
    it('should return "Welcome to authentications!"', () => {
      appController = app.get<AuthenticationController>(
        AuthenticationController
      );
      expect(appController.getData()).toEqual(
        'Welcome to authentications!10-11-81'
      );
    });
  });

  describe('guestLogin', () => {
    it('should always return {accessToken, refreshToken} if it pass the interceptor', async () => {
      const response = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: 'sompop12345' }
      );
      expect(response).toBeDefined();
      expect(response.accessToken).toBeDefined();
      expect(response.refreshToken).toBeDefined();
    });
    it('should not create a new credential when the same deviceUUID call this', async () => {
      const deviceUUID = 'abc1345';
      const response = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      expect(response).toBeDefined();
      const firstResponseCredentialId = await (
        await service.getGuestCredentialFromDeviceUUID(deviceUUID)
      )._id;
      const secondReponse = await appController.guestLogin(
        { $device: 'android', $language: 'en', $platform: 'android' } as any,
        { deviceUUID: deviceUUID }
      );
      expect(secondReponse).toBeDefined();
      expect(response).not.toEqual(secondReponse);
      const secondResponseCredentialId = await (
        await service.getGuestCredentialFromDeviceUUID(deviceUUID)
      )._id;
      expect(firstResponseCredentialId).toEqual(secondResponseCredentialId);
    });
    it('should create new credential when the credetnail form this device is already signup', async () => {
      const response = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: 'sompop12345' }
      );
      const currentCredential = await service.getCredentialFromAccessToken(
        response.accessToken
      );
      const currentAccountId = currentCredential.account._id;
      expect(currentAccountId).toBeDefined();
      expect(currentCredential.account.isGuest).toBe(true);
      //signup current Account

      const result = await service._accountModel
        .findById(currentAccountId)
        .exec();
      const accountActivation = await service.signupByEmail(result, {
        displayId: 'test',
        displayName: 'testpass',
        email: 'sp@sp.com',
        password: '2@HelloWorld'
      });
      //result.isGuest = false;
      //await result.save();

      const afterVerify = await service.verifyAccount(accountActivation);
      expect(afterVerify.isGuest).toBe(false);
      const response2 = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: 'sompop12345' }
      );
      const postCredential = await service.getCredentialFromAccessToken(
        response2.accessToken
      );
      expect(postCredential.account.isGuest).toBe(true);
      expect(postCredential.account._id === currentAccountId).toBe(false);
    });
  });
  describe('refreshToken', () => {
    it('should get new accessToken with refreshToken', async () => {
      const deviceUUID = 'abc1345';
      const language = 'th';
      const response = await appController.guestLogin(
        { $device: 'iphone', $language: language, $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      const refreshTokenResponse = await appController.refreshToken({
        $token: response.refreshToken,
        $language: language
      } as any);
      expect(refreshTokenResponse).toBeDefined();
      expect(refreshTokenResponse.accessToken).toBeDefined();
      expect(response.accessToken).not.toEqual(
        refreshTokenResponse.accessToken
      );
      const credentialFromToken = await service.getCredentialFromAccessToken(
        refreshTokenResponse.accessToken
      );
      const credentialFromDeviceUUID =
        await service.getGuestCredentialFromDeviceUUID(deviceUUID);
      expect(credentialFromDeviceUUID._id).toEqual(credentialFromToken._id);
    });
  });

  describe('checkEmailExists', () => {
    it('should check in User if the id is exists', async () => {
      const testEmail = 'sompop@castcle.com';
      let response = await appController.checkEmailExists(
        { $language: 'th' } as any,
        testEmail
      );
      expect(response.payload.exist).toBe(false);
      const result = await service.createAccount({
        device: 'ios',
        header: { platform: 'ios' },
        languagesPreferences: ['th', 'th'],
        deviceUUID: 'test'
      });
      result.accountDocument.email = testEmail;
      await result.accountDocument.save();
      response = await appController.checkEmailExists(
        { $language: 'th' } as any,
        testEmail
      );
      expect(response.payload.exist).toBe(true);
    });
  });

  describe('checkCastcleIdExists', () => {
    it('should check in User if the id is exists', async () => {
      const testId = 'randomId';
      const deviceUUID = 'sompop12345';
      await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      const randomAccount = await service.getAccountFromCredential(
        await service.getGuestCredentialFromDeviceUUID(deviceUUID)
      );
      let result = await appController.checkCastcleIdExists({
        castcleId: testId
      });
      expect(result.payload.exist).toBe(false);
      const newUserResult = await new service._userModel({
        ownerAccount: randomAccount._id,
        displayName: 'random',
        displayId: testId.toLowerCase(),
        type: 'people'
      }).save();
      expect(newUserResult).not.toBeNull();
      console.log(newUserResult);
      result = await appController.checkCastcleIdExists({ castcleId: testId });
      expect(result.payload.exist).toBe(true);
    });
    it('should detect case sensitive of castcleId', async () => {
      const testId = 'ranDomId'; //D is a case sensitive
      const result = await appController.checkCastcleIdExists({
        castcleId: testId
      });
      expect(result.payload.exist).toBe(true);
    });
  });

  describe('register', () => {
    let guestResult: TokenResponse;
    let credentialGuest: CredentialDocument;
    let tokens: TokenResponse;
    const testId = 'registerId';
    const registerEmail = 'sompop.kulapalanont@gmail.com';
    const deviceUUID = 'sompo007';
    it('should create new account with email and new user with id ', async () => {
      let result = await appController.checkCastcleIdExists({
        castcleId: testId
      });
      expect(result.payload.exist).toBe(false);
      let response = await appController.checkEmailExists(
        { $language: 'th' } as any,
        registerEmail
      );
      expect(response.payload.exist).toBe(false);
      guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );

      tokens = await appController.register(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'testLang'
        } as any,
        {
          channel: 'email',
          payload: {
            castcleId: testId,
            displayName: 'abc',
            email: registerEmail,
            password: '2@HelloWorld'
          }
        }
      );
      //after register
      result = await appController.checkCastcleIdExists({ castcleId: testId });
      expect(result.payload.exist).toBe(true);
      response = await appController.checkEmailExists(
        { $language: 'th' } as any,
        registerEmail
      );
      expect(response.payload.exist).toBe(true);

      //check if it's the same account
      const guestCredentialFromDeviceID =
        await service.getGuestCredentialFromDeviceUUID(deviceUUID);
      expect(guestCredentialFromDeviceID).toBeNull(); //this credential should be null because it's already signup so it's not a guess
      const credentialFromDeviceID = await service.getCredentialFromAccessToken(
        tokens.accessToken
      );
      const accountFromEmail = await service.getAccountFromEmail(registerEmail);
      const accountFromDeviceID = await service.getAccountFromCredential(
        credentialFromDeviceID
      );
      expect(accountFromEmail._id).toEqual(accountFromDeviceID._id);
      const accountActivation =
        await service.getAccountActivationFromCredential(credentialGuest);
      expect(accountActivation).toBeDefined();
    });
    // TODO !!! find a way to create a test to detect exception in troller
  });

  describe('login', () => {
    const testId = 'registerId2';
    const registerEmail = 'sompop2.kulapalanont@gmail.com';
    const password = '2@HelloWorld';
    const deviceUUID = 'sompop12345';
    const newDeviceUUID = 'sompop54321';
    it('should be able to login after register', async () => {
      const guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      const credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      const tokens = await appController.register(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'testLang'
        } as any,
        {
          channel: 'email',
          payload: {
            castcleId: testId,
            displayName: 'abc',
            email: registerEmail,
            password: password
          }
        }
      );
      // TODO !!! find a way to create a test to detect exception in controller
      const result = await appController.login(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'th'
        } as any,
        {
          password: password,
          username: registerEmail
        }
      );
      expect(result).toBeDefined();
    });
    it('should be able to login with different device', async () => {
      const guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: newDeviceUUID }
      );
      const credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      const result = await appController.login(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'th'
        } as any,
        {
          password: password,
          username: registerEmail
        }
      );

      const linkAccount = await service.getAccountFromEmail(registerEmail);
      expect(linkAccount.credentials.length).toEqual(2);
      const loginCredential = await service.getCredentialFromAccessToken(
        result.accessToken
      );
      const postResult = await appController.login(
        {
          $credential: loginCredential,
          $token: result.accessToken,
          $language: 'th'
        } as any,
        {
          password: password,
          username: registerEmail
        }
      );
      expect(postResult).toBeDefined();
      //that token could be use for refreshToken;
      const refreshTokenResult = await appController.refreshToken({
        $token: postResult.refreshToken,
        $language: 'th'
      } as any);
      expect(refreshTokenResult).toBeDefined();
      expect(refreshTokenResult.accessToken).toBeDefined();
    });
  });
  describe('verificationEmail', () => {
    it('should set verifyDate for both account and accountActivation', async () => {
      const testId = 'registerId3';
      const registerEmail = 'sompop3.kulapalanont@gmail.com';
      const password = '2@HelloWorld';
      const deviceUUID = 'sompop12341';
      const guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      const credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      await appController.register(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'testLang'
        } as any,
        {
          channel: 'email',
          payload: {
            castcleId: testId,
            displayName: 'abc',
            email: registerEmail,
            password: password
          }
        }
      );
      const preAccountActivation =
        await service.getAccountActivationFromCredential(credentialGuest);
      expect(preAccountActivation.activationDate).not.toBeDefined();
      const result = await appController.verificationEmail({
        $token: preAccountActivation.verifyToken,
        $language: 'th'
      } as any);
      expect(result).toEqual('');
      const postAccountActivation =
        await service.getAccountActivationFromCredential(credentialGuest);
      expect(postAccountActivation.activationDate).toBeDefined();
      const acc = await service.getAccountFromCredential(credentialGuest);
      expect(acc.activateDate).toBeDefined();
      expect(acc.isGuest).toBe(false);
    });
  });

  describe('requestLinkVerify', () => {
    it('should update verifyToken and revocationDate after success', async () => {
      const testId = 'registerId4';
      const registerEmail = 'sompop4.kulapalanont@gmail.com';
      const password = '2@HelloWorld';
      const deviceUUID = 'sompop12341';
      const guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      const credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      await appController.register(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'testLang'
        } as any,
        {
          channel: 'email',
          payload: {
            castcleId: testId,
            displayName: 'abc',
            email: registerEmail,
            password: password
          }
        }
      );
      const preAccountActivationToken =
        await service.getAccountActivationFromCredential(credentialGuest);
      const preToken = preAccountActivationToken.verifyToken;
      expect(preAccountActivationToken.revocationDate).not.toBeDefined();
      await appController.requestLinkVerify({
        $credential: credentialGuest,
        $language: 'th',
        $token: credentialGuest.accessToken
      } as any);
      const postAccountActivationToken =
        await service.getAccountActivationFromCredential(credentialGuest);
      expect(preToken).not.toEqual(postAccountActivationToken.verifyToken);
      expect(postAccountActivationToken.revocationDate).toBeDefined();
    });
  });

  describe('forgotPasswordRequestOTP', () => {
    it('should get otp email after success', async () => {
      const channel = 'email';
      const email = 'sompop3.kulapalanont@gmail.com';
      const deviceUUID = 'sompop12341';
      const guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      const credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      const result = await appController.forgotPasswordRequestOTP(
        {
          channel: channel,
          payload: {
            email: email,
            countryCode: '',
            mobileNumber: ''
          }
        },
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'th'
        } as any
      );
      expect(result).not.toBeNull;
      expect(result.refCode).toHaveLength(8);
    });
  });
});
