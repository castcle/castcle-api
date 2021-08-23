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
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { AuthenticationService } from './authentication.service';
import { UserService } from './user.service';
import { ContentService } from './content.service';
import { env } from '../environment';
import { AccountDocument } from '../schemas/account.schema';
import { CredentialDocument } from '../schemas/credential.schema';
import { MongooseForFeatures, MongooseAsyncFeatures } from '../database.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ContentSchema } from '../schemas/content.schema';
import { SaveContentDto, ContentType } from '../dtos';
import { UserDocument } from '../schemas';
import { ShortPayload } from '../dtos/content.dto';

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
        ...options
      };
    }
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('ContentService', () => {
  let service: ContentService;
  let userService: UserService;
  let authService: AuthenticationService;
  let user: UserDocument;
  console.log('test in real db = ', env.db_test_in_db);
  const importModules = env.db_test_in_db
    ? [
        MongooseModule.forRoot(env.db_uri, env.db_options),
        MongooseAsyncFeatures,
        MongooseForFeatures
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [ContentService, UserService, AuthenticationService];
  let result: {
    accountDocument: AccountDocument;
    credentialDocument: CredentialDocument;
  };
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers
    }).compile();
    service = module.get<ContentService>(ContentService);
    userService = module.get<UserService>(UserService);
    authService = module.get<AuthenticationService>(AuthenticationService);
    result = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios'
      },
      device: 'ifong'
    });
    //sign up to create actual account
    await authService.signupByEmail(result.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567'
    });
    user = await userService.getUserFromCredential(result.credentialDocument);
  });
  afterAll(async () => {
    if (env.db_test_in_db) await closeInMongodConnection();
  });
  describe('#createContentFromUser', () => {
    it('should create short content instance in db with author as user', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload
      });
      expect((content.payload as ShortPayload).message).toEqual(
        shortPayload.message
      );
      expect(content.type).toEqual(ContentType.Short);
      expect(content.author.id).toEqual(user._id);
    });
  });
  describe('#updateContentFromId()', () => {
    it('should update from saveDTO with content id', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload
      });
      const revisionCount = content.revisionCount;
      const updatePayload: ShortPayload = {
        message: 'this is test status2',
        link: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=yuPjoC3jmPA'
          }
        ]
      };
      const result = await service.updateContentFromId(content._id, {
        type: ContentType.Short,
        payload: updatePayload
      });
      expect((result.payload as ShortPayload).message).toEqual(
        updatePayload.message
      );
      expect((result.payload as ShortPayload).link).toEqual(updatePayload.link);
      const postContent = await service.getContentFromId(content._id);
      expect((postContent.payload as ShortPayload).message).toEqual(
        updatePayload.message
      );
      expect((postContent.payload as ShortPayload).link).toEqual(
        updatePayload.link
      );
      expect(postContent.revisionCount).toEqual(revisionCount + 1);
    });
  });
  describe('#getContentsFromUser()', () => {
    it('should return ContentDocument[] from author', async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
      const shortPayload1: ShortPayload = {
        message: 'Order 1'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload1
      });
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
      const shortPayload2: ShortPayload = {
        message: 'Order 2'
      };
      const content2 = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2
      });
      const contents = await service.getContentsFromUser(user);
      console.log(contents);
      expect(contents.items[0].payload).toEqual(shortPayload2);
      expect(contents.items[1].payload).toEqual(shortPayload1);
      const contentsInverse = await service.getContentsFromUser(user, {
        sortBy: {
          field: 'updateAt',
          type: 'asc'
        }
      });
      expect(
        contentsInverse.items[contentsInverse.items.length - 2].payload
      ).toEqual(shortPayload1);
      expect(
        contentsInverse.items[contentsInverse.items.length - 1].payload
      ).toEqual(shortPayload2);
    });
  });
});
