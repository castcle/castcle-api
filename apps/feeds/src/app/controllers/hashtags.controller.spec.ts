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
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  UserService,
} from '@castcle-api/database';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { HashtagsController } from './hashtags.controller';

describe('HashtagsController', () => {
  let mongod: MongoMemoryServer;
  let app: TestingModule;
  let appController: HashtagsController;
  let hashtagService: HashtagService;
  let authService: AuthenticationService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
      ],
      controllers: [HashtagsController],
      providers: [
        HashtagService,
        AuthenticationService,
        {
          provide: UserService,
          useValue: { getUserFromCredential: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<HashtagsController>(HashtagsController);
    hashtagService = app.get<HashtagService>(HashtagService);
    authService = app.get<AuthenticationService>(AuthenticationService);

    const resultAccount = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th'],
    });
    resultAccount.credentialDocument;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('getAllHashtags', () => {
    it('should get all hashtag in db', async () => {
      await hashtagService.create({
        tag: 'castcle',
        score: 90,
        aggregator: {
          _id: '6138afa4f616a467b5c4eb72',
        },
        name: 'Castcle',
      });
      const result = await appController.getAllHashtags();
      const expectResult = {
        message: 'success',
        payload: [
          {
            id: '',
            slug: 'castcle',
            name: 'Castcle',
            key: 'hashtag.castcle',
          },
        ],
      };
      result.payload[0].id = '';
      expect(expectResult).toEqual(result);
    });
  });

  describe('hashtagSearch', () => {
    it('should get hashtag with search keyword', async () => {
      await hashtagService.create({
        tag: 'btc',
        score: 1000,
        aggregator: {
          _id: '6138afa4f616a467b5c4eb72',
        },
        name: 'BTC',
      });
      const result = await appController.hashtagSearch('');
      expect(result.payload.length).toEqual(2);
      expect(result.payload[0].rank).toEqual(1);
      expect(result.payload[0].slug).toEqual('btc');
      expect(result.payload[1].rank).toEqual(2);
      expect(result.payload[1].slug).toEqual('castcle');

      const resultKeyword = await appController.hashtagSearch('bt');
      expect(resultKeyword.payload.length).toEqual(1);
      expect(resultKeyword.payload[0].rank).toEqual(1);
      expect(resultKeyword.payload[0].slug).toEqual('btc');
    });
  });
});
