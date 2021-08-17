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
import { CreateContentDto, ContentType } from '../dtos';
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
});
