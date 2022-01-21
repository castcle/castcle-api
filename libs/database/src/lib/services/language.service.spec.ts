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
import {
  LanguageService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { LanguagePayloadDto } from '../dtos';
import { env } from '../environment';

let mongod: MongoMemoryServer;
const rootMongooseTestModule = (
  options: MongooseModuleOptions = { useFindAndModify: false }
) =>
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

describe('LanguageService', () => {
  let service: LanguageService;
  console.log('test in real db = ', env.DB_TEST_IN_DB);
  const importModules = env.DB_TEST_IN_DB
    ? [
        MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [LanguageService];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers,
    }).compile();
    service = module.get<LanguageService>(LanguageService);
  });

  afterAll(async () => {
    if (env.DB_TEST_IN_DB) await closeInMongodConnection();
  });

  describe('#create and get all language', () => {
    it('should create new language in db', async () => {
      const newLanguage: LanguagePayloadDto = {
        code: 'th',
        title: 'Thai',
        display: 'ภาษาไทย',
      };

      const resultData = await service.create(newLanguage);

      expect(resultData).toBeDefined();
      expect(resultData.code).toEqual(newLanguage.code);
      expect(resultData.title).toEqual(newLanguage.title);
      expect(resultData.display).toEqual(newLanguage.display);
    });

    it('should get data in db', async () => {
      const result = await service.getAll();
      expect(result).toBeDefined();
      expect(result.length).toEqual(1);
    });
  });
});
