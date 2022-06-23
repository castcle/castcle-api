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
  CountryService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
} from '../database.module';
import { CountryPayloadDto, SortDirection } from '../dtos';
import { Repository } from '../repositories';
import { MetadataServiceV2 } from './metadata.service.v2';

describe('CountryService', () => {
  let moduleRef: TestingModule;
  let metadataServiceV2: MetadataServiceV2;
  let mongod: MongoMemoryServer;
  let service: CountryService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule,
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ],
      providers: [CountryService, MetadataServiceV2, Repository],
    }).compile();
    service = moduleRef.get<CountryService>(CountryService);
    metadataServiceV2 = moduleRef.get<MetadataServiceV2>(MetadataServiceV2);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('#create and get all language', () => {
    it('should create new language in db', async () => {
      const newCountry: CountryPayloadDto = {
        code: 'TH',
        dialCode: '+66',
        name: 'Thailand',
        flag: 'url',
      };
      const newCountry2: CountryPayloadDto = {
        code: 'US',
        dialCode: '+1',
        name: 'U.S.A.',
        flag: 'url',
      };
      const newCountry3: CountryPayloadDto = {
        code: 'CN',
        dialCode: '+86',
        name: 'China',
        flag: 'url',
      };
      const resultData = await service.create(newCountry);
      const resultData2 = await service.create(newCountry2);
      const resultData3 = await service.create(newCountry3);
      expect(resultData).toBeDefined();
      expect(resultData.code).toEqual(newCountry.code);
      expect(resultData.dialCode).toEqual(newCountry.dialCode);
      expect(resultData.name).toEqual(newCountry.name);
      expect(resultData.flag).toEqual(newCountry.flag);
      expect(resultData2).toBeDefined();
      expect(resultData3).toBeDefined();
    });

    it('should get data in db', async () => {
      const result = await service.getAll();
      expect(result).toBeDefined();
      expect(result.length).toEqual(3);
    });

    it('should get data in db with search criteria', async () => {
      const result = await service.getAll({
        sortBy: {
          field: 'dialCode',
          type: SortDirection.ASC,
        },
      });
      expect(result).toBeDefined();
      expect(result[0].dialCode).toEqual('+1');
    });
  });

  describe('getCountry', () => {
    beforeAll(async () => {
      await service.create({
        code: 'TH',
        dialCode: '+66',
        name: 'Thailand',
        flag: 'url',
      });

      await service.create({
        code: 'US',
        dialCode: '+1',
        name: 'U.S.A.',
        flag: 'url',
      });

      await service.create({
        code: 'CN',
        dialCode: '+86',
        name: 'China',
        flag: 'url',
      });
    });
    it('should return country sort ny name asc', async () => {
      const countries = await metadataServiceV2.getAllCountry({
        name: 1,
      });

      const countriesResponse = countries.map((country) =>
        country.toCountryPayload(),
      );

      expect(countriesResponse[countriesResponse.length - 1]).toEqual({
        code: 'US',
        dialCode: '+1',
        name: 'U.S.A.',
        flag: 'url',
      });

      expect(countriesResponse[0]).toEqual({
        code: 'CN',
        dialCode: '+86',
        name: 'China',
        flag: 'url',
      });
    });

    it('should return country sort ny name desc', async () => {
      const countries = await metadataServiceV2.getAllCountry({
        name: -1,
      });
      const countriesResponse = countries.map((country) =>
        country.toCountryPayload(),
      );
      expect(countriesResponse[0]).toEqual({
        code: 'US',
        dialCode: '+1',
        name: 'U.S.A.',
        flag: 'url',
      });

      expect(countriesResponse[countriesResponse.length - 1]).toEqual({
        code: 'CN',
        dialCode: '+86',
        name: 'China',
        flag: 'url',
      });
    });
  });

  describe('#getByDialCode', () => {
    it('should get ByDialCode in db', async () => {
      const result = await service.getByDialCode('+66');
      expect(result).toBeDefined();
      expect(result.dialCode).toEqual('+66');
    });
  });
});
