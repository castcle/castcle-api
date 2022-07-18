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
  MetadataServiceV2,
  MetadataType,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '@castcle-api/database';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'libs/database/src/lib/repositories';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { LanguagesController } from './languages.controller';

describe('LanguagesController', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let appController: LanguagesController;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
      ],
      controllers: [LanguagesController],
      providers: [MetadataServiceV2, Repository],
    }).compile();

    appController = app.get<LanguagesController>(LanguagesController);
    const metadataModel = app.get(getModelToken('Metadata'));

    await new metadataModel({
      type: MetadataType.LANGUAGE,
      payload: {
        code: 'th',
        title: 'Thai',
        display: 'ภาษาไทย',
      },
    }).save();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('getAllLanguage', () => {
    it('should get all language in db', async () => {
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

      expect(expectResult).toEqual(result);
    });
  });
});
