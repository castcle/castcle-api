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
  MongooseAsyncFeatures,
  MongooseForFeatures
} from '@castcle-api/database';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import {
  UserService,
  AuthenticationService,
  ContentService
} from '@castcle-api/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  CredentialDocument,
  UserDocument,
  AccountDocument,
  ContentDocument
} from '@castcle-api/database/schemas';
import {
  ContentsResponse,
  ContentType,
  SaveContentDto,
  ShortPayload,
  UpdateUserDto
} from '@castcle-api/database/dtos';
import { CastcleException } from '@castcle-api/utils/exception';

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
  let appController: AppController;
  let service: UserService;
  let appService: AppService;
  let contentService: ContentService;
  let authService: AuthenticationService;
  let userCredential: CredentialDocument;
  let userAccount: AccountDocument;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures
      ],
      controllers: [AppController],
      providers: [
        AppService,
        UserService,
        AuthenticationService,
        ContentService
      ]
    }).compile();
    service = app.get<UserService>(UserService);
    appService = app.get<AppService>(AppService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    const result = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th']
    });
    const accountActivation = await authService.signupByEmail(
      result.accountDocument,
      {
        email: 'test@gmail.com',
        displayId: 'test1234',
        displayName: 'test',
        password: '1234AbcD'
      }
    );
    userAccount = await authService.verifyAccount(accountActivation);
    userCredential = result.credentialDocument;
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });
  describe('getData', () => {
    it('should return "Welcome to users!"', () => {
      appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({ message: 'Welcome to users!' });
    });
  });

  describe('getMyData', () => {
    it('should return UserResponseDto of current credential', async () => {
      const response = await appController.getMyData({
        $credential: userCredential,
        $language: 'th'
      } as any);
      const user = await service.getUserFromCredential(userCredential);
      expect(response).toBeDefined();
      expect(response.castcleId).toEqual(user.displayId);
      expect(response.email).toEqual(userAccount.email);
      //appController.getMyData()
    });
  });

  describe('getUserById', () => {
    it('should return UserResponseDto of user id ', async () => {
      const user = await service.getUserFromCredential(userCredential);
      const response = await appController.getUserById(
        { $credential: userCredential, $language: 'th' } as any,
        user._id
      );
      expect(response).toBeDefined();
      expect(response.castcleId).toEqual(user.displayId);
      expect(response.email).toEqual(userAccount.email);
    });
  });

  describe('updateMyData', () => {
    it('should update partial data from UpdateUserDto', async () => {
      const user = await service.getUserFromCredential(userCredential);
      expect((await user.toUserResponse()).dob).toBeNull();
      //check full response
      const updateDto = {
        dob: '1990-12-10',
        links: {
          facebook: 'http://facebook.com/abc',
          medium: 'https://medium.com/abc',
          website: 'https://djjam.app',
          youtube: 'https://youtube.com/abcdef'
        },
        images: {
          avatar: 'https://placehold.it/200x200',
          cover: 'https://placehold.it/1500x300'
        },
        overview: 'this is a test'
      } as UpdateUserDto;

      const responseFull = await appController.updateMyData(
        { $credential: userCredential, $language: 'th' } as any,
        updateDto
      );
      expect(responseFull.dob).toEqual(updateDto.dob);
      expect(responseFull.links).toEqual(updateDto.links);
      expect(responseFull.images).toEqual(updateDto.images);
      expect(responseFull.overview).toEqual(updateDto.overview);
      const postReponse = await appController.getMyData({
        $credential: userCredential,
        $language: 'th'
      } as any);
      expect(postReponse).toEqual(responseFull);
    });
  });

  describe('- Contents related', () => {
    let user: UserDocument;
    const contentDtos: SaveContentDto[] = [
      {
        type: ContentType.Short,
        payload: {
          message: 'hello'
        } as ShortPayload
      },
      {
        type: ContentType.Short,
        payload: {
          message: 'hi'
        } as ShortPayload
      }
    ];
    const contents: ContentDocument[] = [];
    let expectedResponse: ContentsResponse;
    beforeAll(async () => {
      user = await service.getUserFromCredential(userCredential);
      for (let i = 0; i < contentDtos.length; i++)
        contents.push(
          await contentService.createContentFromUser(user, contentDtos[i])
        );
      expectedResponse = {
        payload: contents
          .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
          .map((c) => c.toPagePayload()),
        pagination: {
          limit: 25,
          self: 1
        }
      };
    });
    describe('getMyContents', () => {
      it('should get all contents from current user credential', async () => {
        const response = await appController.getMyContents({
          $credential: userCredential,
          $language: 'th'
        } as any);
        expect(response).toEqual(expectedResponse);
      });
    });

    describe('getUserContents', () => {
      it('should get all contents from user id', async () => {
        const response = await appController.getUserContents(user._id, {
          $credential: userCredential,
          $language: 'th'
        } as any);
        expect(response).toEqual(expectedResponse);
      });
    });
  });
  describe('deleteMyData', () => {
    it('should remove user from User schema', async () => {
      await appController.deleteMyData({
        $credential: userCredential,
        $language: 'th'
      } as any);
      const user = await service.getUserFromCredential(userCredential);
      expect(user).toBeNull();
    });
  });
});
