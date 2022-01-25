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
  CountryService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '@castcle-api/database';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CountryController } from './country.controller';

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

describe('CountryController', () => {
  let appController: CountryController;
  let countryService: CountryService;

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
      controllers: [CountryController],
      providers: [CountryService],
    }).compile();

    appController = app.get<CountryController>(CountryController);
    countryService = app.get<CountryService>(CountryService);

    await countryService.create({
      code: 'TH',
      dialCode: '+66',
      name: 'Thailand',
      flag: 'url',
    });
    await countryService.create({
      code: 'US',
      dialCode: '+1',
      name: 'U.S.A.',
      flag: 'url',
    });
    await countryService.create({
      code: 'CN',
      dialCode: '+86',
      name: 'China',
      flag: 'url',
    });
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('getAllCountry', () => {
    it('should get all country in db', async () => {
      const result = await appController.getAllCountry();
      const expectResult = {
        payload: [
          {
            code: 'CN',
            dialCode: '+86',
            flag: 'url',
            name: 'China',
          },
          {
            code: 'TH',
            dialCode: '+66',
            flag: 'url',
            name: 'Thailand',
          },
          {
            code: 'US',
            dialCode: '+1',
            flag: 'url',
            name: 'U.S.A.',
          },
        ],
      };
      console.log(result);

      expect(expectResult).toEqual(result);
    });
  });
});
