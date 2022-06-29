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
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  LanguageService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { LanguagePayload } from '../models';
describe('LanguageService', () => {
  let moduleRef: TestingModule;
  let mongod: MongoMemoryServer;
  let service: LanguageService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [LanguageService],
    }).compile();

    service = moduleRef.get<LanguageService>(LanguageService);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('#create and get all language', () => {
    it('should create new language in db', async () => {
      const newLanguage = {
        code: 'th',
        title: 'Thai',
        display: 'ภาษาไทย',
      };

      const { payload } = await service.create(newLanguage);

      expect(payload).toBeDefined();
      expect((payload as LanguagePayload).code).toEqual(newLanguage.code);
      expect((payload as LanguagePayload).title).toEqual(newLanguage.title);
      expect((payload as LanguagePayload).display).toEqual(newLanguage.display);
    });

    it('should get data in db', async () => {
      const languagesData = await service.getAll();
      expect(languagesData).toBeDefined();
      expect(languagesData.length).toEqual(1);
    });
  });

  describe('getLanguage', () => {
    beforeAll(async () => {
      await service.create({
        code: 'th',
        title: 'Thai',
        display: 'ภาษาไทย',
      });
    });
    it('should return language in collection', async () => {
      const languages = await service.getAll();
      const languagesResponse = languages.map((language) =>
        language.toMetadataPayload(),
      );
      expect(languagesResponse[0]).toEqual({
        code: 'th',
        title: 'Thai',
        display: 'ภาษาไทย',
      });
    });
  });
});
