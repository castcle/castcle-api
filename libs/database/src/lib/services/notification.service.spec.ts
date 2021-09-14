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
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import {
  DEFAULT_NOTIFICATION_QUERY_OPTIONS,
  NotificationSource
} from '../dtos/notification.dto';
import { env } from '../environment';
import { UserDocument } from '../schemas';
import { AccountDocument } from '../schemas/account.schema';
import { CredentialDocument } from '../schemas/credential.schema';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

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

describe('NotificationService', () => {
  let service: NotificationService;
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
  const providers = [
    ContentService,
    UserService,
    AuthenticationService,
    NotificationService
  ];
  let result: {
    accountDocument: AccountDocument;
    credentialDocument: CredentialDocument;
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers
    }).compile();
    service = module.get<NotificationService>(NotificationService);
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

    const newNoti = new service._notificationModel({
      avatar: '',
      message: 'sample profile',
      source: 'profile',
      sourceUserId: {
        _id: user._id
      },
      type: 'comment',
      targetRef: {
        id: '6138afa4f616a467b5c4eb72'
      },
      read: false,
      credential: result.credentialDocument
    });
    await newNoti.save();

    const newNoti2 = new service._notificationModel({
      avatar: '',
      message: 'sample page',
      source: 'page',
      sourceUserId: user,
      type: 'comment',
      targetRef: {
        id: '6138afa4f616a467b5c4eb72'
      },
      read: false,
      credential: result.credentialDocument
    });
    await newNoti2.save();
    const newNoti3 = new service._notificationModel({
      avatar: '',
      message: 'sample page',
      source: 'profile',
      sourceUserId: user,
      type: 'system',
      targetRef: {
        id: '6138afa4f616a467b5c4eb72'
      },
      read: false,
      credential: result.credentialDocument
    });
    await newNoti3.save();
  });
  afterAll(async () => {
    if (env.db_test_in_db) await closeInMongodConnection();
  });

  describe('#getAll', () => {
    it('should get all notification in db with source as default option', async () => {
      const notification = await service.getAll(result.credentialDocument);
      expect(notification.items.length).toEqual(2);
      expect(notification.items[0].source).toEqual(NotificationSource.Profile);
      expect(notification.items[1].source).toEqual(NotificationSource.Profile);
    });
    it('should get all notification in db with source as page', async () => {
      const notification = await service.getAll(result.credentialDocument, {
        sortBy: DEFAULT_NOTIFICATION_QUERY_OPTIONS.sortBy,
        limit: DEFAULT_NOTIFICATION_QUERY_OPTIONS.limit,
        page: DEFAULT_NOTIFICATION_QUERY_OPTIONS.page,
        source: NotificationSource.Page
      });
      expect(notification.items.length).toEqual(1);
      expect(notification.items[0].source).toEqual(NotificationSource.Page);
    });
  });

  describe('#getFromId', () => {
    it('should get notification in db with id', async () => {
      const allNotification = await service.getAll(result.credentialDocument);
      const notification = await service.getFromId(allNotification.items[0].id);
      expect(notification).toEqual(allNotification.items[0]);
      expect(notification).not.toEqual(allNotification.items[1]);
    });
    it('should get empty notification in db with wrong id', async () => {
      const notification = await service.getFromId('6138afa4f616a467b5c4eb72');
      const notification2 = await service.getFromId(null);
      const notification3 = await service.getFromId('');
      expect(notification).toBeNull();
      expect(notification2).toBeNull();
      expect(notification3).toBeNull();
    });
  });

  describe('#flagRead', () => {
    it('should update read flag notification in db', async () => {
      const allNotification = await service.getAll(result.credentialDocument);
      const updateRead = allNotification.items[0];
      const notificationId = updateRead.id;

      await service.flagRead(updateRead);
      const noti = await service.getFromId(notificationId);
      expect(noti.read).toEqual(true);
    });
    it('should get empty notification in db with empty data', async () => {
      const noti = await service.getFromId(null);
      expect(noti).toBeNull;
    });
  });

  describe('#flagReadAll', () => {
    it('should update read flag all notification in db', async () => {
      const resultUpdate = await service.flagReadAll(result.credentialDocument);
      const profileNoti = await service.getAll(result.credentialDocument);
      const pageNoti = await service.getAll(result.credentialDocument, {
        sortBy: DEFAULT_NOTIFICATION_QUERY_OPTIONS.sortBy,
        limit: DEFAULT_NOTIFICATION_QUERY_OPTIONS.limit,
        page: DEFAULT_NOTIFICATION_QUERY_OPTIONS.page,
        source: NotificationSource.Page
      });

      expect(resultUpdate.n).toEqual(3);
      expect(profileNoti.items.filter((x) => x.read).length).toEqual(
        profileNoti.items.length
      );
      expect(pageNoti.items.filter((x) => x.read).length).toEqual(
        pageNoti.items.length
      );
    });

    it('should not update read flag notification in db with wrong credential', async () => {
      const mockCredential = result.credentialDocument;
      mockCredential.account._id = '6138afa4f616a467b5c4eb72';
      const resultUpdate = await service.flagReadAll(mockCredential);
      expect(resultUpdate).toBeNull;
    });

    it('should not update read flag notification in db with empty credential', async () => {
      const mockCredential = result.credentialDocument;
      mockCredential.account._id = null;
      const resultUpdate = await service.flagReadAll(mockCredential);
      expect(resultUpdate).toBeNull;
    });
  });
});
