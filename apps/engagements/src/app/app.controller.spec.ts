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
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AuthenticationService,
  ContentService,
  UxEngagementService,
  MongooseAsyncFeatures,
  MongooseForFeatures
} from '@castcle-api/database';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import {
  AccountDocument,
  CredentialDocument
} from '@castcle-api/database/schemas';
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
  let uxEngagementService: UxEngagementService;
  let authService: AuthenticationService;
  let accountDocument: AccountDocument;
  let credentialDocument: CredentialDocument;
  let appController: AppController;

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
        ContentService,
        AuthenticationService,
        UxEngagementService
      ]
    }).compile();
    uxEngagementService = app.get<UxEngagementService>(UxEngagementService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    appController = app.get<AppController>(AppController);
    const result = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th']
    });
    accountDocument = result.accountDocument;
    credentialDocument = result.credentialDocument;
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('getData', () => {
    it('should return "Welcome to engagements!"', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({
        message: 'Welcome to engagements!'
      });
    });
  });
  describe('track', () => {
    it('should be able to track if have the correct body', async () => {
      const now = new Date();
      const result = await appController.track(
        {
          platform: 'android',
          accountId: accountDocument._id as string,
          client: 'android1234',
          eventData: { test: 'hi' },
          eventType: 'test',
          feedItemId: '1234',
          screenId: 'testScreenId',
          screenInstance: { abcd: 1234 },
          target: 'testTarget',
          targetId: 'testTargetId',
          timestamp: now.getTime() + '',
          uxSessionId: 'ux-track-01'
        },
        {
          $credential: credentialDocument,
          $language: 'th'
        } as any
      );
      expect(result).toEqual('');
    });
  });
});
