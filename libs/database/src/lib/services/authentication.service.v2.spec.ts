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

import { AWSClient } from '@castcle-api/utils/aws';
import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { FacebookClientMock } from 'libs/utils/clients/src/lib/facebook/facebook.client.spec';
import { GoogleClientMock } from 'libs/utils/clients/src/lib/google/google.client.spec';
import { TwilioClientMock } from 'libs/utils/clients/src/lib/twilio/twilio.client.mock';
import { TwitterClientMock } from 'libs/utils/clients/src/lib/twitter/twitter.client.spec';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  AnalyticService,
  AuthenticationServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { AcceptPlatform, OwnerResponse } from '../dtos';
import { Repository } from '../repositories';
import { Account } from '../schemas';

describe('AuthenticationServiceV2', () => {
  let mongod: MongoMemoryReplSet;
  let moduleRef: TestingModule;
  let service: AuthenticationServiceV2;
  let repository: Repository;

  let loginResponse = {} as {
    account: Account;
    accessToken: string;
    refreshToken: string;
    profile: OwnerResponse;
    pages: OwnerResponse[];
  };

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        AuthenticationServiceV2,
        AnalyticService,
        { provide: FacebookClient, useValue: FacebookClientMock },
        { provide: GoogleClient, useValue: GoogleClientMock },
        { provide: TwilioClient, useValue: TwilioClientMock },
        { provide: TwitterClient, useValue: TwitterClientMock },
        { provide: Mailer, useValue: { sendRegistrationEmail: jest.fn() } },
        Repository,
      ],
    }).compile();

    service = moduleRef.get(AuthenticationServiceV2);
    repository = moduleRef.get(Repository);

    jest.spyOn(AWSClient, 'getCastcleIdMetadata').mockResolvedValue({
      bannedWords: ['bitch', 'admin', 'web'],
      nouns: ['apple'],
      adjectives: ['green'],
      minLength: 4,
      maxLength: 20,
    });

    const { accessToken } = await service.guestLogin({
      device: 'iPhone01',
      deviceUUID: '83b696d7-320b-4402-a412-d9cee10fc6a3',
      languagesPreferences: ['en'],
      header: {
        platform: 'iOs',
      },
    });

    loginResponse = {
      ...loginResponse,
      ...(await service.registerWithEmail(
        await repository.findCredential({ accessToken }),
        {
          email: 'tester@castcle.com',
          password: '2@HelloWorld',
          displayName: 'Tester',
          castcleId: 'tester',
          hostUrl: 'https://www.castcle.com',
          ip: '::1',
        },
      )),
    };
    const user = await repository.findUser({ _id: loginResponse.profile.id });
    loginResponse.account = await repository.findAccount({
      _id: user.ownerAccount,
    });
  });

  afterAll(async () => {
    await Promise.all([moduleRef.close(), mongod.stop()]);
  });

  describe('#guestLogin()', () => {
    it('should return access token and refresh token after guestLogin', async () => {
      const tokenResponse = await service.guestLogin({
        device: 'iPhone01',
        deviceUUID: '83b696d7-320b-4402-a412-d9cee10fc6a3',
        languagesPreferences: ['en'],
        header: {
          platform: 'iOs',
        },
      });
      expect(tokenResponse.accessToken).toBeDefined();
      expect(tokenResponse.refreshToken).toBeDefined();
    });
  });

  describe('#getExistedUserFromCastcleId()', () => {
    it('should create an accountActivation', () => {
      expect(loginResponse).toBeDefined();
    });

    it('should return null if user does not exist', async () => {
      const id = 'undefined';
      const findUser = await service.getExistedUserFromCastcleId(id);
      expect(findUser).toBeNull();
    });

    it('should return existing user', async () => {
      const id = loginResponse.profile.castcleId;
      const findUser = await service.getExistedUserFromCastcleId(id);
      expect(findUser).not.toBeNull();
    });
  });

  describe('#getAccountFromEmail()', () => {
    it('should return null for non-existent email', async () => {
      const email = 'non-existent-email';
      const account = await service.getAccountFromEmail(email);
      expect(account).toBeNull();
    });

    it('should found an account that have email match', async () => {
      const email = loginResponse.profile.email;
      const account = await service.getAccountFromEmail(email);
      expect(account._id).toEqual(loginResponse.account._id);
    });
  });

  describe('#createAccountDevice', () => {
    const androidDevice = {
      uuid: 'uuid-android',
      firebaseToken: 'firebase-token',
      platform: AcceptPlatform.Android,
    };

    const iosDevice = {
      uuid: 'uuid-ios',
      firebaseToken: 'firebase-token',
      platform: AcceptPlatform.IOS,
    };

    beforeAll(async () => {
      await service.createAccountDevice(androidDevice, loginResponse.account);
    });

    it('should create a new device if platform does not exist', () => {
      expect(loginResponse.account.devices).toHaveLength(1);
      expect(loginResponse.account.devices[0]).toMatchObject(androidDevice);
    });

    it('should append a new device to devices if platform does not exist', async () => {
      await service.createAccountDevice(iosDevice, loginResponse.account);

      expect(loginResponse.account.devices).toHaveLength(2);
      expect(loginResponse.account.devices[0]).toMatchObject(androidDevice);
      expect(loginResponse.account.devices[1]).toMatchObject(iosDevice);
    });

    it('should update the device token if platform already exists', async () => {
      androidDevice.firebaseToken = 'new-firebase-token';
      await service.createAccountDevice(androidDevice, loginResponse.account);

      expect(loginResponse.account.devices).toHaveLength(2);
      expect(loginResponse.account.devices[0]).toMatchObject(androidDevice);
      expect(loginResponse.account.devices[1]).toMatchObject(iosDevice);
    });

    describe('#deleteAccountDevice', () => {
      it('should delete device ios platform', async () => {
        await service.deleteAccountDevice(androidDevice, loginResponse.account);

        loginResponse.account = await repository.findAccount({
          _id: loginResponse.account._id,
        });

        expect(loginResponse.account.devices).toHaveLength(1);
      });
    });
  });

  describe('#suggestCastcleId', () => {
    it('should return suggest name', async () => {
      const suggestId = await service.suggestCastcleId('John555');
      expect(suggestId).toEqual('john555');
    });

    it('should return suggest name duplicate name', async () => {
      const suggestId = await service.suggestCastcleId(
        loginResponse.profile.castcleId,
      );

      /* castcle id + date time */
      expect(suggestId).toMatch(loginResponse.profile.castcleId);
    });

    it('should return suggest new name', async () => {
      const suggestId = await service.suggestCastcleId('bitch');

      expect(suggestId).toEqual('greenapple');
    });
  });
});
