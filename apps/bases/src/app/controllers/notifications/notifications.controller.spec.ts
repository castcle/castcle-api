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
  ContentService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  UserService
} from '@castcle-api/database';
import {
  DEFAULT_NOTIFICATION_QUERY_OPTIONS,
  NotificationSource
} from '@castcle-api/database/dtos';
import {
  CredentialDocument,
  UserDocument
} from '@castcle-api/database/schemas';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { CacheModule } from '@nestjs/common/cache';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppService } from '../../app.service';
import { NotificationsController } from './notifications.controller';

let mongodMock: MongoMemoryServer;

const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongodMock = await MongoMemoryServer.create();
      const mongoUri = mongodMock.getUri();
      return {
        uri: mongoUri,
        ...options
      };
    }
  });

const closeInMongodConnection = async () => {
  if (mongodMock) await mongodMock.stop();
};

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let app: TestingModule;
  let userService: UserService;
  let authService: AuthenticationService;
  let userCredential: CredentialDocument;
  let notification: NotificationService;
  let user: UserDocument;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        CacheModule.register({
          store: 'memory',
          ttl: 1000
        })
      ],
      controllers: [NotificationsController],
      providers: [
        AppService,
        UserService,
        AuthenticationService,
        ContentService,
        NotificationService
      ]
    }).compile();
    userService = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    notification = app.get<NotificationService>(NotificationService);
    controller = app.get<NotificationsController>(NotificationsController);
    const resultAccount = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th']
    });
    const accountActivation = await authService.signupByEmail(
      resultAccount.accountDocument,
      {
        email: 'test@gmail.com',
        displayId: 'test1234',
        displayName: 'test',
        password: '1234AbcD'
      }
    );
    userCredential = resultAccount.credentialDocument;
    user = await userService.getUserFromCredential(
      resultAccount.credentialDocument
    );

    const newNoti = new notification._notificationModel({
      avatar: '',
      message: 'sample profile',
      source: 'profile',
      sourceUserId: user,
      type: 'comment',
      targetRef: {
        id: '6138afa4f616a467b5c4eb72'
      },
      read: false,
      credential: resultAccount.credentialDocument
    });
    await newNoti.save();

    const newNoti2 = new notification._notificationModel({
      avatar: '',
      message: 'sample page',
      source: 'page',
      sourceUserId: user,
      type: 'comment',
      targetRef: {
        id: '6138afa4f616a467b5c4eb72'
      },
      read: false,
      credential: resultAccount.credentialDocument
    });
    await newNoti2.save();
    const newNoti3 = new notification._notificationModel({
      avatar: '',
      message: 'sample page',
      source: 'profile',
      sourceUserId: user,
      type: 'system',
      targetRef: {
        id: '6138afa4f616a467b5c4eb72'
      },
      read: false,
      credential: resultAccount.credentialDocument
    });
    await newNoti3.save();
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('getNotification', () => {
    it('should return NotificationReponse that contain all notification default option [profile]', async () => {
      const responseResult = await controller.getAll({
        $credential: userCredential
      } as any);

      const expectResult = {
        payload: [
          {
            id: '',
            avatar: '',
            message: 'sample page',
            source: 'profile',
            read: false,
            content: {
              id: null
            },
            comment: {
              id: null
            },
            system: {
              id: '6138afa4f616a467b5c4eb72'
            }
          },
          {
            id: '',
            avatar: '',
            message: 'sample profile',
            source: 'profile',
            read: false,
            content: {
              id: null
            },
            comment: {
              id: '6138afa4f616a467b5c4eb72'
            },
            system: {
              id: null
            }
          }
        ]
      };

      responseResult.payload.forEach((x) => (x.id = ''));
      expect(responseResult.payload).toEqual(expectResult.payload);
      expect(responseResult.payload.length).toEqual(2);
      expect(responseResult.payload.filter((x) => x.comment.id).length).toEqual(
        1
      );
      expect(responseResult.payload.filter((x) => x.system.id).length).toEqual(
        1
      );
    });

    it('should return NotificationReponse that contain all notification source page', async () => {
      const responseResult = await controller.getAll(
        {
          $credential: userCredential
        } as any,
        DEFAULT_NOTIFICATION_QUERY_OPTIONS.sortBy,
        DEFAULT_NOTIFICATION_QUERY_OPTIONS.page,
        DEFAULT_NOTIFICATION_QUERY_OPTIONS.limit,
        NotificationSource.Page
      );
      const expectResult = {
        payload: [
          {
            id: '',
            avatar: '',
            message: 'sample page',
            source: 'page',
            read: false,
            content: {
              id: null
            },
            comment: {
              id: '6138afa4f616a467b5c4eb72'
            },
            system: {
              id: null
            }
          }
        ]
      };

      responseResult.payload.forEach((x) => (x.id = ''));
      expect(responseResult.payload).toEqual(expectResult.payload);
      expect(responseResult.payload.length).toEqual(1);
      expect(responseResult.payload.filter((x) => x.comment.id).length).toEqual(
        1
      );
      expect(responseResult.payload.filter((x) => x.system.id).length).toEqual(
        0
      );
    });
  });

  describe('notifications read', () => {
    it('should success update read status', async () => {
      const allNotification = await controller.getAll({
        $credential: userCredential
      } as any);

      const readNoti = allNotification.payload[0];
      await controller.notificationRead(readNoti.id, {
        $credential: userCredential
      } as any);

      const result = await controller.getAll({
        $credential: userCredential
      } as any);

      expect(
        result.payload.find((x) => x.id.toString() === readNoti.id.toString())
          .read
      ).toEqual(true);
    });

    it('should return Exception as expect', async () => {
      const allNotification = await controller.getAll({
        $credential: userCredential
      } as any);

      await expect(
        controller.notificationRead('', {
          $credential: userCredential
        } as any)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.NOTIFICATION_NOT_FOUND, 'th')
      );

      userCredential.account._id = '6138afa4f616a467b5c4eb72';
      await expect(
        controller.notificationRead('', {
          $credential: userCredential
        } as any)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, 'th')
      );
    });
  });
});
