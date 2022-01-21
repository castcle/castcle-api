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
  LanguageService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '@castcle-api/database';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { LanguagesController } from './languages.controller';

let mongodMock: MongoMemoryServer;

const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongodMock = await MongoMemoryServer.create();
      const mongoUri = mongodMock.getUri();
      return {
        uri: mongoUri,
        ...options,
      };
    },
  });

const closeInMongodConnection = async () => {
  if (mongodMock) await mongodMock.stop();
};

describe('LanguagesController', () => {
  let appController: LanguagesController;
  let languageService: LanguageService;
  let authService: AuthenticationService;

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
      ],
      controllers: [LanguagesController],
      providers: [LanguageService, AuthenticationService],
    }).compile();

    appController = app.get<LanguagesController>(LanguagesController);
    languageService = app.get<LanguageService>(LanguageService);
    authService = app.get<AuthenticationService>(AuthenticationService);

    await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th'],
    });
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('getAllLanguage', () => {
    it('should get all language in db', async () => {
      await languageService.create({
        code: 'th',
        title: 'Thai',
        display: 'ภาษาไทย',
      });
      const result = await appController.getAllLanguage();
      const expectResult = {
        payload: [
          {
            code: 'th',
            title: 'Thai',
            display: 'ภาษาไทย',
          },
        ],
      };
      console.log(result);

      expect(expectResult).toEqual(result);
    });
  });
});
