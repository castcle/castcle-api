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
import {
  AuthenticationService,
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  UserService,
} from '@castcle-api/database';
import { generateMockUsers, MockUserDetail } from '@castcle-api/database/mocks';
import {
  AccountAuthenIdType,
  CredentialDocument,
  OtpObjective,
} from '@castcle-api/database/schemas';
import { Downloader, Image } from '@castcle-api/utils/aws';
import {
  AppleClient,
  FacebookClient,
  GoogleClient,
  TelegramClient,
  TwillioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { UtilsQueueModule } from '@castcle-api/utils/queue';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AuthenticationController } from './app.controller';
import { AppService } from './app.service';
import {
  AppleClientMock,
  DownloaderMock,
  FacebookClientMock,
  GoogleClientMock,
  TelegramClientMock,
  TwillioClientMock,
  TwitterClientMock,
} from './client.mock';
import { LoginResponse, TokenResponse } from './dtos/dto';

let mongod: MongoMemoryServer;
const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongod = await MongoMemoryServer.create();
      const mongoUri = mongod.getUri();
      return {
        uri: mongoUri,
        ...options,
      };
    },
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

const mockResponse: any = {
  json: jest.fn(),
  status: () => ({
    send: jest.fn(),
  }),
};

const createMockCredential = async (
  appController: AuthenticationController,
  service: AuthenticationService,
  deviceUUID: string,
  castcleId: string,
  displayName: string,
  email: string,
  password: string,
  skipRegister: boolean
) => {
  const guestResult = await appController.guestLogin(
    { $device: 'iphone', $language: 'th', $platform: 'IOS' } as any,
    { deviceUUID: deviceUUID }
  );
  const guestAccount = await service.getCredentialFromAccessToken(
    guestResult.accessToken
  );

  if (!skipRegister) {
    await appController.register(
      {
        $credential: guestAccount,
        $token: guestResult.accessToken,
        $language: 'th',
      } as any,
      {
        channel: 'email',
        payload: {
          castcleId: castcleId,
          displayName: displayName,
          email: email,
          password: password,
        },
      }
    );
  }

  const credentialGuest = {
    $credential: guestAccount,
    $token: guestResult.accessToken,
    $language: 'th',
  } as any;

  return credentialGuest;
};

describe('AppController', () => {
  let app: TestingModule;
  let appController: AuthenticationController;
  let service: AuthenticationService;
  let appService: AppService;
  let userService: UserService;

  beforeAll(async () => {
    const FacebookClientProvider = {
      provide: FacebookClient,
      useClass: FacebookClientMock,
    };
    const DownloaderProvider = {
      provide: Downloader,
      useClass: DownloaderMock,
    };
    const TelegramClientProvider = {
      provide: TelegramClient,
      useClass: TelegramClientMock,
    };
    const TwitterClientProvider = {
      provide: TwitterClient,
      useClass: TwitterClientMock,
    };
    const TwillioClientProvider = {
      provide: TwillioClient,
      useClass: TwillioClientMock,
    };
    const AppleClientProvider = {
      provide: AppleClient,
      useClass: AppleClientMock,
    };
    const GoogleClientProvider = {
      provide: GoogleClient,
      useClass: GoogleClientMock,
    };

    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        HttpModule,
        UtilsQueueModule,
      ],
      controllers: [AuthenticationController],
      providers: [
        AppService,
        AuthenticationService,
        FacebookClientProvider,
        DownloaderProvider,
        TelegramClientProvider,
        TwitterClientProvider,
        TwillioClientProvider,
        AppleClientProvider,
        GoogleClientProvider,
        UserService,
        ContentService,
        HashtagService,
      ],
    }).compile();

    service = app.get<AuthenticationService>(AuthenticationService);
    appService = app.get<AppService>(AppService);
    appController = app.get<AuthenticationController>(AuthenticationController);
    userService = app.get<UserService>(UserService);

    jest.spyOn(appService, '_uploadImage').mockImplementation(async () => {
      console.log('---mock uri--image');
      const mockImage = new Image({
        original: 'test',
      });
      return mockImage;
    });
    jest
      .spyOn(appService, 'sendRegistrationEmail')
      .mockImplementation(async () => console.log('send email from mock'));
  });
  afterAll(async () => {
    await closeInMongodConnection();
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
        password: '2@HelloWorld',
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
        $language: language,
      } as any);
      expect(refreshTokenResponse).toBeDefined();
      expect(refreshTokenResponse.accessToken).toBeDefined();
      expect(refreshTokenResponse.profile).toBeDefined();
      expect(refreshTokenResponse.pages).toBeDefined();
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

    it('should get Exception Refresh token is expired', async () => {
      const language = 'th';
      await expect(
        appController.refreshToken({
          $token: '123',
          $language: language,
        } as any)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.INVALID_REFRESH_TOKEN, language)
      );
    });
  });

  describe('checkEmailExists', () => {
    it('should check in User if the id is exists', async () => {
      const testEmail = 'sompop@castcle.com';
      let response = await appController.checkEmailExists(
        { $language: 'th' } as any,
        {
          email: testEmail,
        }
      );
      expect(response.payload.exist).toBe(false);
      const result = await service.createAccount({
        device: 'ios',
        header: { platform: 'ios' },
        languagesPreferences: ['th', 'th'],
        deviceUUID: 'test',
      });
      result.accountDocument.email = testEmail;
      await result.accountDocument.save();
      response = await appController.checkEmailExists(
        { $language: 'th' } as any,
        {
          email: testEmail,
        }
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
        castcleId: testId,
      });
      expect(result.payload.exist).toBe(false);
      const newUserResult = await new service._userModel({
        ownerAccount: randomAccount._id,
        displayName: 'random',
        displayId: testId.toLowerCase(),
        type: 'people',
      }).save();
      expect(newUserResult).not.toBeNull();
      console.log(newUserResult);
      result = await appController.checkCastcleIdExists({ castcleId: testId });
      expect(result.payload.exist).toBe(true);
    });
    it('should detect case sensitive of castcleId', async () => {
      const testId = 'ranDomId'; //D is a case sensitive
      const result = await appController.checkCastcleIdExists({
        castcleId: testId,
      });
      expect(result.payload.exist).toBe(true);
    });
  });

  describe('register', () => {
    let guestResult: TokenResponse;
    let credentialGuest: CredentialDocument;
    let tokens: LoginResponse;
    const testId = 'registerId';
    const registerEmail = 'sompop.kulapalanont@gmail.com';
    const deviceUUID = 'sompo007';
    it('should create new account with email and new user with id ', async () => {
      let result = await appController.checkCastcleIdExists({
        castcleId: testId,
      });
      expect(result.payload.exist).toBe(false);
      let response = await appController.checkEmailExists(
        { $language: 'th' } as any,
        { email: registerEmail }
      );
      expect(response.payload.exist).toBe(false);
      guestResult = await appController.guestLogin(
        {
          $device: 'iphone',
          $language: 'th',
          $platform: 'iOs',
        } as any,
        { deviceUUID: deviceUUID }
      );
      credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );

      tokens = await appController.register(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'testLang',
        } as any,
        {
          channel: 'email',
          payload: {
            castcleId: testId,
            displayName: 'abc',
            email: registerEmail,
            password: '2@HelloWorld',
          },
        }
      );

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.profile).toBeDefined();
      expect(tokens.pages).toBeDefined();

      //after register
      result = await appController.checkCastcleIdExists({ castcleId: testId });
      expect(result.payload.exist).toBe(true);
      response = await appController.checkEmailExists(
        { $language: 'th' } as any,
        { email: registerEmail }
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
      await appController.register(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'testLang',
        } as any,
        {
          channel: 'email',
          payload: {
            castcleId: testId,
            displayName: 'abc',
            email: registerEmail,
            password: password,
          },
        }
      );
      const currentUser = await userService.getUserFromCredential(
        credentialGuest
      );
      await userService.createPageFromUser(currentUser, {
        displayName: 'new Page',
        castcleId: 'npop2',
      });
      // TODO !!! find a way to create a test to detect exception in controller
      const result = await appController.login(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'th',
        } as any,
        {
          password: password,
          username: registerEmail,
        }
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.profile).toBeDefined();
      expect(result.pages).toBeDefined();
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
          $language: 'th',
        } as any,
        {
          password: password,
          username: registerEmail,
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
          $language: 'th',
        } as any,
        {
          password: password,
          username: registerEmail,
        }
      );

      expect(postResult).toBeDefined();
      expect(postResult.accessToken).toBeDefined();
      expect(postResult.refreshToken).toBeDefined();
      expect(postResult.profile).toBeDefined();
      expect(postResult.pages).toBeDefined();
      //that token could be use for refreshToken;
      const refreshTokenResult = await appController.refreshToken({
        $token: postResult.refreshToken,
        $language: 'th',
      } as any);
      expect(refreshTokenResult).toBeDefined();
      expect(refreshTokenResult.accessToken).toBeDefined();
      expect(refreshTokenResult.profile).toBeDefined();
      expect(refreshTokenResult.pages).toBeDefined();
    });

    it('should get Exception when wrong email', async () => {
      const language = 'th';
      const guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      const credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      await expect(
        appController.login(
          {
            $credential: credentialGuest,
            $token: guestResult.accessToken,
            $language: language,
          } as any,
          {
            password: password,
            username: 'error',
          }
        )
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.INVALID_EMAIL_OR_PASSWORD, language)
      );
    });

    it('should get Exception when wrong password', async () => {
      const language = 'th';
      const guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: deviceUUID }
      );
      const credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      await expect(
        appController.login(
          {
            $credential: credentialGuest,
            $token: guestResult.accessToken,
            $language: language,
          } as any,
          {
            password: '1234',
            username: registerEmail,
          }
        )
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.INVALID_EMAIL_OR_PASSWORD, language)
      );
    });

    it('should be able to login and return all pages', async () => {
      const mockpassword = '2@HelloWorld';
      const mocks = await generateMockUsers(1, 50, {
        accountService: service,
        userService: userService,
      });

      const guestResult = await appController.guestLogin(
        { $device: 'iphone13', $language: 'th', $platform: 'iOs' } as any,
        { deviceUUID: 'i13Test' }
      );
      const credentialGuest = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      const result = await appController.login(
        {
          $credential: credentialGuest,
          $token: guestResult.accessToken,
          $language: 'th',
        } as any,
        {
          password: mockpassword,
          username: mocks[0].account.email,
        }
      );

      expect(result).toBeDefined();
      expect(result.profile).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.pages).toBeDefined();
      expect(result.pages.length).toEqual(50);
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
          $language: 'testLang',
        } as any,
        {
          channel: 'email',
          payload: {
            castcleId: testId,
            displayName: 'abc',
            email: registerEmail,
            password: password,
          },
        }
      );
      const preAccountActivation =
        await service.getAccountActivationFromCredential(credentialGuest);
      expect(preAccountActivation.activationDate).not.toBeDefined();
      const result = await appController.verificationEmail({
        $token: preAccountActivation.verifyToken,
        $language: 'th',
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

  describe('verifyPassword Flows', () => {
    let registerResult: LoginResponse;
    let genRefCode: string;
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
        registerResult = await appController.register(
          {
            $credential: credentialGuest,
            $token: guestResult.accessToken,
            $language: 'testLang',
          } as any,
          {
            channel: 'email',
            payload: {
              castcleId: testId,
              displayName: 'abc',
              email: registerEmail,
              password: password,
            },
          }
        );
        const preAccountActivationToken =
          await service.getAccountActivationFromCredential(credentialGuest);
        const preToken = preAccountActivationToken.verifyToken;
        expect(preAccountActivationToken.revocationDate).not.toBeDefined();
        await appController.requestLinkVerify(
          {
            $credential: credentialGuest,
            $language: 'th',
            $token: credentialGuest.accessToken,
          } as any,
          mockResponse
        );
        const postAccountActivationToken =
          await service.getAccountActivationFromCredential(credentialGuest);
        expect(preToken).not.toEqual(postAccountActivationToken.verifyToken);
        expect(postAccountActivationToken.revocationDate).toBeDefined();
      });
    });

    describe('verificationPassword', () => {
      it('it should create otp document after send', async () => {
        const credential = await service.getCredentialFromAccessToken(
          registerResult.accessToken
        );
        const response = await appController.verificationPassword(
          {
            objective: OtpObjective.ChangePassword,
            password: '2@HelloWorld',
          },
          {
            $credential: credential,
            $language: 'th',
          } as any
        );

        expect(response.refCode).toBeDefined();
        genRefCode = response.refCode;
        expect(response.expiresTime).toBeDefined();
      });

      it('should return exception when wrong objective', async () => {
        const credential = await service.getCredentialFromAccessToken(
          registerResult.accessToken
        );
        await expect(
          appController.verificationPassword(
            {
              objective: OtpObjective.ForgotPassword,
              password: '2@HelloWorld',
            },
            {
              $credential: credential,
              $language: 'th',
            } as any
          )
        ).rejects.toEqual(
          new CastcleException(CastcleStatus.PAYLOAD_TYPE_MISMATCH, 'th')
        );
      });
    });

    describe('changePasswordSubmit', () => {
      it('should be able to change password', async () => {
        const credential = await service.getCredentialFromAccessToken(
          registerResult.accessToken
        );
        const response = await appController.changePasswordSubmit(
          {
            objective: OtpObjective.ChangePassword,
            newPassword: '2@BlaBlaBla',
            refCode: genRefCode,
          },
          {
            $credential: credential,
            $language: 'th',
          } as any
        );
        expect(response).toEqual('');
      });

      it('should return exception when wrong objective', async () => {
        const credential = await service.getCredentialFromAccessToken(
          registerResult.accessToken
        );
        await expect(
          appController.changePasswordSubmit(
            {
              objective: OtpObjective.VerifyMobile,
              newPassword: '2@BlaBlaBla',
              refCode: genRefCode,
            },
            {
              $credential: credential,
              $language: 'th',
            } as any
          )
        ).rejects.toEqual(
          new CastcleException(CastcleStatus.PAYLOAD_TYPE_MISMATCH, 'th')
        );
      });
    });
  });

  describe('loginWithSocial', () => {
    let credentialGuest = null;
    let mockUsers: MockUserDetail[] = [];
    beforeAll(async () => {
      mockUsers = await generateMockUsers(3, 0, {
        userService: userService,
        accountService: service,
      });

      credentialGuest = {
        $credential: mockUsers[0].credential,
        $language: 'th',
      } as any;
    });

    it('should create new account with new user by social ', async () => {
      const result = await appController.loginWithSocial(credentialGuest, {
        provider: AccountAuthenIdType.Facebook,
        uid: '109364223',
        displayName: 'test facebook',
        avatar: '',
        email: 'testfb@gmail.com',
        authToken: '',
      });
      const accountSocial = await service.getAccountAuthenIdFromSocialId(
        '109364223',
        AccountAuthenIdType.Facebook
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(accountSocial.socialId).toEqual('109364223');
    });

    it('should create new account with generate castcle id', async () => {
      const guestResult = await appController.guestLogin(
        { $device: 'iphone', $language: 'th', $platform: 'IOS' } as any,
        { deviceUUID: 'test1232425' }
      );
      const guestAccount = await service.getCredentialFromAccessToken(
        guestResult.accessToken
      );
      const newCredentialGuest = {
        $credential: guestAccount,
        $token: guestResult.accessToken,
        $language: 'th',
      } as any;

      await appController.loginWithSocial(newCredentialGuest, {
        provider: AccountAuthenIdType.Google,
        uid: '109364223777',
      });
      const accountSocial = await service.getAccountAuthenIdFromSocialId(
        '109364223777',
        AccountAuthenIdType.Google
      );
      const user = await userService.getUserAndPagesFromAccountId(
        accountSocial.account._id
      );

      expect(user).toBeDefined();
      expect(user[0].displayId).toEqual('gg109364223777');
    });

    it('should get existing user and return', async () => {
      const newCredentialGuest = {
        $credential: mockUsers[1].credential,
        $language: 'th',
      } as any;
      const result = await appController.loginWithSocial(newCredentialGuest, {
        provider: AccountAuthenIdType.Facebook,
        uid: '109364223',
        displayName: 'test facebook',
        avatar: '',
        email: 'testfb@gmail.com',
        authToken: '',
      });
      const accountSocial = await service.getAccountAuthenIdFromSocialId(
        '109364223',
        AccountAuthenIdType.Facebook
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(accountSocial.socialId).toEqual('109364223');
    });

    it('should return Exception when invalid use duplicate email', async () => {
      const newCredentialGuest = {
        $credential: mockUsers[2].credential,
        $language: 'th',
      } as any;

      await expect(
        appController.loginWithSocial(newCredentialGuest, {
          provider: AccountAuthenIdType.Twitter,
          uid: '01234567892388',
          displayName: 'test twitter',
          avatar: '',
          email: 'testfb@gmail.com',
          authToken: '',
        })
      ).rejects.toEqual(new CastcleException(CastcleStatus.DUPLICATE_EMAIL));
    });
  });

  describe('connectWithSocial', () => {
    let credentialGuest = null;
    let mockUsers: MockUserDetail[] = [];
    beforeAll(async () => {
      mockUsers = await generateMockUsers(1, 0, {
        userService: userService,
        accountService: service,
      });

      credentialGuest = {
        $credential: mockUsers[0].credential,
        $language: 'th',
      } as any;
    });

    it('should create new social connect map to user ', async () => {
      const beforeConnect = await service.getAccountAuthenIdFromSocialId(
        '10936456',
        AccountAuthenIdType.Facebook
      );
      await appController.connectWithSocial(credentialGuest, {
        provider: AccountAuthenIdType.Facebook,
        uid: '10936456',
        displayName: 'test facebook',
        avatar: '',
        email: mockUsers[0].account.email,
        authToken: '',
      });
      const afterConnect = await service.getAccountAuthenIdFromSocialId(
        '10936456',
        AccountAuthenIdType.Facebook
      );

      expect(beforeConnect).toBeNull();
      expect(afterConnect.socialId).toEqual('10936456');
    });

    it('should return Exception when use duplicate social id', async () => {
      await expect(
        appController.connectWithSocial(credentialGuest, {
          provider: AccountAuthenIdType.Facebook,
          uid: '10936456',
          displayName: 'test facebook',
          avatar: '',
          email: mockUsers[0].account.email,
          authToken: '',
        })
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.SOCIAL_PROVIDER_IS_EXIST)
      );
    });
  });

  describe('requestOTP', () => {
    let credentialGuest = null;
    const emailTest = 'test.opt@gmail.com';
    const countryCodeTest = '+66';
    const numberTest = '0817896767';
    beforeAll(async () => {
      const testId = 'registerId34';
      const password = '2@HelloWorld';
      const deviceUUID = 'sompop12341';
      credentialGuest = await createMockCredential(
        appController,
        service,
        deviceUUID,
        testId,
        'abc',
        emailTest,
        password,
        false
      );

      const acc = await service.getAccountFromCredential(
        credentialGuest.$credential
      );
      await service._accountModel
        .updateOne(
          { _id: acc.id },
          { 'mobile.countryCode': countryCodeTest, 'mobile.number': numberTest }
        )
        .exec();
    });

    it('should request otp via mobile successful', async () => {
      const request = {
        objective: 'forgot_password',
        channel: 'mobile',
        payload: {
          email: '',
          countryCode: countryCodeTest,
          mobileNumber: numberTest,
        },
      };
      const result = await appController.requestOTP(request, credentialGuest);

      expect(result).toBeDefined;
      expect(result.refCode).toBeDefined;
      expect(result.expiresTime).toBeDefined;

      const resultAgain = await appController.requestOTP(
        request,
        credentialGuest
      );

      expect(resultAgain).toBeDefined;
      expect(resultAgain.refCode).toEqual(result.refCode);
      expect(resultAgain.expiresTime).toEqual(result.expiresTime);
    });

    it('should return new otp when change mobile number', async () => {
      const mobileNumber = '0817896700';
      const request = {
        objective: 'verify_mobile',
        channel: 'mobile',
        payload: {
          email: '',
          countryCode: countryCodeTest,
          mobileNumber: mobileNumber,
        },
      };
      const result = await appController.requestOTP(request, credentialGuest);

      expect(result).toBeDefined;
      expect(result.refCode).toBeDefined;
      expect(result.expiresTime).toBeDefined;
      const newMobileNumber = '0817896769';
      const requestnew = {
        objective: 'verify_mobile',
        channel: 'mobile',
        payload: {
          email: '',
          countryCode: countryCodeTest,
          mobileNumber: newMobileNumber,
        },
      };

      const resultAgain = await appController.requestOTP(
        requestnew,
        credentialGuest
      );

      expect(resultAgain).toBeDefined;
      expect(resultAgain.refCode).not.toEqual(result.refCode);
      expect(resultAgain.expiresTime).not.toEqual(result.expiresTime);
    });

    it('should request otp via email successful', async () => {
      const request = {
        objective: 'forgot_password',
        channel: 'email',
        payload: {
          email: emailTest,
          countryCode: '',
          mobileNumber: '',
        },
      };
      const result = await appController.requestOTP(request, credentialGuest);

      expect(result).toBeDefined;
      expect(result.refCode).toBeDefined;
      expect(result.expiresTime).toBeDefined;

      const resultAgain = await appController.requestOTP(
        request,
        credentialGuest
      );

      expect(resultAgain).toBeDefined;
      expect(resultAgain.refCode).toEqual(result.refCode);
      expect(resultAgain.expiresTime).toEqual(result.expiresTime);
    });

    it('should return Exception when get wrong channel', async () => {
      await expect(
        appController.requestOTP(
          {
            objective: 'forgot_password',
            channel: 'test',
            payload: {
              email: emailTest,
              countryCode: '',
              mobileNumber: '',
            },
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
          credentialGuest.$language
        )
      );
    });

    it('should return Exception when get wrong channel', async () => {
      const allExistingOtp = await service.getAllOtpFromRequestIdObjective(
        credentialGuest.$credential.account._id,
        OtpObjective.ForgotPassword
      );
      for (const { exOtp } of allExistingOtp.map((exOtp) => ({ exOtp }))) {
        await exOtp.delete();
      }

      await expect(
        appController.requestOTP(
          {
            objective: 'forgot_password',
            channel: 'mobile',
            payload: {
              email: emailTest,
              countryCode: '',
              mobileNumber: '',
            },
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.EMAIL_OR_PHONE_NOTFOUND,
          credentialGuest.$language
        )
      );

      await expect(
        appController.requestOTP(
          {
            objective: 'forgot_password',
            channel: 'email',
            payload: {
              email: '',
              countryCode: '',
              mobileNumber: '',
            },
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.EMAIL_OR_PHONE_NOTFOUND,
          credentialGuest.$language
        )
      );
    });

    it('should return exception when wrong objective', async () => {
      const allExistingOtp = await service.getAllOtpFromRequestIdObjective(
        credentialGuest.$credential.account._id,
        OtpObjective.ForgotPassword
      );
      for (const { exOtp } of allExistingOtp.map((exOtp) => ({ exOtp }))) {
        await exOtp.delete();
      }

      const request = () => {
        return {
          objective: 'forgot_password2555',
          channel: 'email',
          payload: {
            email: emailTest,
            countryCode: '',
            mobileNumber: '',
          },
        };
      };
      await expect(
        appController.requestOTP(request(), credentialGuest)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_TYPE_MISMATCH,
          credentialGuest.$language
        )
      );
    });

    it('should return exception when duplicate mobile number', async () => {
      const request = () => {
        return {
          objective: 'verify_mobile',
          channel: 'mobile',
          payload: {
            email: '',
            countryCode: countryCodeTest,
            mobileNumber: numberTest,
          },
        };
      };
      await expect(
        appController.requestOTP(request(), credentialGuest)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.MOBILE_NUMBER_IS_EXIST,
          credentialGuest.$language
        )
      );
    });

    it('should return exception when use guest account', async () => {
      const testId = 'registerId34';
      const password = '2@HelloWorld';
      const deviceUUID = 'sompop12341';
      const guest = await createMockCredential(
        appController,
        service,
        deviceUUID,
        testId,
        'abc',
        emailTest,
        password,
        true
      );

      const request = () => {
        return {
          objective: 'verify_mobile',
          channel: 'mobile',
          payload: {
            email: '',
            countryCode: countryCodeTest,
            mobileNumber: '815678989',
          },
        };
      };
      await expect(appController.requestOTP(request(), guest)).rejects.toEqual(
        new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, guest.$language)
      );
    });
  });

  describe('verificationOTP', () => {
    let credentialGuest = null;
    const emailTest = 'testverify@gmail.com';
    const countryCodeTest = '+66';
    const numberTest = '0817896888';
    beforeAll(async () => {
      const testId = 'verify01';
      const password = '2@HelloWorld';
      const deviceUUID = 'verifyuuid';

      credentialGuest = await createMockCredential(
        appController,
        service,
        deviceUUID,
        testId,
        'abc',
        emailTest,
        password,
        false
      );
      const acc = await service.getAccountFromCredential(
        credentialGuest.$credential
      );
      await service._accountModel
        .updateOne(
          { _id: acc.id },
          { 'mobile.countryCode': countryCodeTest, 'mobile.number': numberTest }
        )
        .exec();
    });

    it('should pass verify otp mobile channel', async () => {
      const otpCode = await appController.requestOTP(
        {
          objective: 'forgot_password',
          channel: 'mobile',
          payload: {
            email: '',
            countryCode: countryCodeTest,
            mobileNumber: numberTest,
          },
        },
        credentialGuest
      );

      const result = await appController.verificationOTP(
        {
          objective: 'forgot_password',
          channel: 'mobile',
          payload: {
            email: '',
            countryCode: countryCodeTest,
            mobileNumber: numberTest,
          },
          refCode: otpCode.refCode,
          otp: '123456',
        },
        credentialGuest
      );

      expect(result).toBeDefined;
      expect(result.refCode).toBeDefined;
      expect(result.expiresTime).toBeDefined;
    });

    it('should pass verify otp email channel', async () => {
      const otpCode = await appController.requestOTP(
        {
          objective: 'forgot_password',
          channel: 'email',
          payload: {
            email: emailTest,
            countryCode: '',
            mobileNumber: '',
          },
        },
        credentialGuest
      );

      const result = await appController.verificationOTP(
        {
          objective: 'forgot_password',
          channel: 'email',
          payload: {
            email: emailTest,
            countryCode: '',
            mobileNumber: '',
          },
          refCode: otpCode.refCode,
          otp: '123456',
        },
        credentialGuest
      );

      expect(result).toBeDefined;
      expect(result.refCode).toBeDefined;
      expect(result.expiresTime).toBeDefined;
    });

    it('should return Exception when get wrong channel', async () => {
      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'test',
            payload: {
              email: emailTest,
              countryCode: '',
              mobileNumber: '',
            },
            refCode: '67845676',
            otp: '123456',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
          credentialGuest.$language
        )
      );
    });

    it('should return Exception when get empty account', async () => {
      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'mobile',
            payload: {
              email: emailTest,
              countryCode: '',
              mobileNumber: '',
            },
            refCode: '67845676',
            otp: '123456',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.EMAIL_OR_PHONE_NOTFOUND,
          credentialGuest.$language
        )
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'email',
            payload: {
              email: '',
              countryCode: '',
              mobileNumber: '',
            },
            refCode: '67845676',
            otp: '123456',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.EMAIL_OR_PHONE_NOTFOUND,
          credentialGuest.$language
        )
      );
    });

    it('should return exception when wrong objective', async () => {
      const allExistingOtp = await service.getAllOtpFromRequestIdObjective(
        credentialGuest.$credential.account._id,
        OtpObjective.ForgotPassword
      );
      for (const { exOtp } of allExistingOtp.map((exOtp) => ({ exOtp }))) {
        await exOtp.delete();
      }

      const otpCode = await appController.requestOTP(
        {
          objective: 'forgot_password',
          channel: 'mobile',
          payload: {
            email: '',
            countryCode: countryCodeTest,
            mobileNumber: numberTest,
          },
        },
        credentialGuest
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password2555',
            channel: 'mobile',
            payload: {
              email: '',
              countryCode: countryCodeTest,
              mobileNumber: numberTest,
            },
            refCode: '123456',
            otp: '123456',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_TYPE_MISMATCH,
          credentialGuest.$language
        )
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'change_password',
            channel: 'mobile',
            payload: {
              email: '',
              countryCode: countryCodeTest,
              mobileNumber: numberTest,
            },
            refCode: otpCode.refCode,
            otp: '123456',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_TYPE_MISMATCH,
          credentialGuest.$language
        )
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'email',
            payload: {
              email: emailTest,
              countryCode: '',
              mobileNumber: '',
            },
            refCode: otpCode.refCode,
            otp: '123456',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_CHANNEL_MISMATCH,
          credentialGuest.$language
        )
      );
    });

    it('should return exception when wrong ref code', async () => {
      const allExistingOtp = await service.getAllOtpFromRequestIdObjective(
        credentialGuest.$credential.account._id,
        OtpObjective.ForgotPassword
      );
      for (const { exOtp } of allExistingOtp.map((exOtp) => ({ exOtp }))) {
        await exOtp.delete();
      }

      await appController.requestOTP(
        {
          objective: 'forgot_password',
          channel: 'mobile',
          payload: {
            email: '',
            countryCode: countryCodeTest,
            mobileNumber: numberTest,
          },
        },
        credentialGuest
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'mobile',
            payload: {
              email: '',
              countryCode: countryCodeTest,
              mobileNumber: numberTest,
            },
            refCode: '123456',
            otp: '123456',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.INVLAID_REFCODE,
          credentialGuest.$language
        )
      );
    });

    it('should return Exception when imvalid otp and return lock otp when over 3 times', async () => {
      const allExistingOtp = await service.getAllOtpFromRequestIdObjective(
        credentialGuest.$credential.account._id,
        OtpObjective.ForgotPassword
      );
      for (const { exOtp } of allExistingOtp.map((exOtp) => ({ exOtp }))) {
        await exOtp.delete();
      }

      const otpCode = await appController.requestOTP(
        {
          objective: 'forgot_password',
          channel: 'mobile',
          payload: {
            email: '',
            countryCode: countryCodeTest,
            mobileNumber: numberTest,
          },
        },
        credentialGuest
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'mobile',
            payload: {
              email: '',
              countryCode: countryCodeTest,
              mobileNumber: numberTest,
            },
            refCode: otpCode.refCode,
            otp: '000000',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.INVALID_OTP,
          credentialGuest.$language
        )
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'mobile',
            payload: {
              email: '',
              countryCode: countryCodeTest,
              mobileNumber: numberTest,
            },
            refCode: otpCode.refCode,
            otp: '000000',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.INVALID_OTP,
          credentialGuest.$language
        )
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'mobile',
            payload: {
              email: '',
              countryCode: countryCodeTest,
              mobileNumber: numberTest,
            },
            refCode: otpCode.refCode,
            otp: '000000',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.INVALID_OTP,
          credentialGuest.$language
        )
      );

      await expect(
        appController.verificationOTP(
          {
            objective: 'forgot_password',
            channel: 'mobile',
            payload: {
              email: '',
              countryCode: countryCodeTest,
              mobileNumber: numberTest,
            },
            refCode: otpCode.refCode,
            otp: '000000',
          },
          credentialGuest
        )
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.LOCKED_OTP,
          credentialGuest.$language
        )
      );
    });
  });
});
