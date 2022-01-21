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
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  UserService,
} from '@castcle-api/database';
import {
  NotificationSource,
  NotificationType,
  RegisterTokenDto,
} from '@castcle-api/database/dtos';
import {
  CredentialDocument,
  UserDocument,
} from '@castcle-api/database/schemas';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import {
  NotificationProducer,
  TopicName,
  UserProducer,
} from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common/cache';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NotificationsController } from './notifications.controller';

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

const buildMockData = async (
  notification: NotificationService,
  user: UserDocument,
  userCredential: CredentialDocument
) => {
  await creatMockData(
    notification,
    user,
    NotificationSource.Profile,
    NotificationType.Comment,
    '6138afa4f616a467b5c4eb72',
    userCredential
  );

  await creatMockData(
    notification,
    user,
    NotificationSource.Page,
    NotificationType.Comment,
    '6138afa4f616a467b5c4eb72',
    userCredential
  );

  await creatMockData(
    notification,
    user,
    NotificationSource.Profile,
    NotificationType.System,
    '6138afa4f616a467b5c4eb72',
    userCredential
  );
};

const creatMockData = async (
  notification: NotificationService,
  user: UserDocument,
  sourceType: NotificationSource,
  typeNoti: NotificationType,
  docRefId: string,
  userCredential: CredentialDocument
) => {
  const newNotification = new notification._notificationModel({
    avatar: '',
    message: `sample ${sourceType}`,
    source: sourceType,
    sourceUserId: user,
    type: typeNoti,
    targetRef: {
      $ref: typeNoti !== NotificationType.System ? typeNoti : null,
      $id: docRefId,
    },
    read: false,
    account: {
      _id: userCredential.account._id,
    },
  });
  await newNotification.save();
};

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let app: TestingModule;
  let userService: UserService;
  let authService: AuthenticationService;
  let userCredential: CredentialDocument;
  let wrongUserCredential: CredentialDocument;
  let notification: NotificationService;
  let user: UserDocument;
  const fakeProcessor = jest.fn();

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        CacheModule.register({
          store: 'memory',
          ttl: 1000,
        }),
        BullModule.registerQueue({
          name: TopicName.Notifications,
          redis: {
            host: '0.0.0.0',
            port: 6380,
          },
          processors: [fakeProcessor],
        }),
        BullModule.registerQueue({
          name: TopicName.Users,
          redis: {
            host: '0.0.0.0',
            port: 6380,
          },
          processors: [fakeProcessor],
        }),
      ],
      controllers: [NotificationsController],
      providers: [
        UserService,
        AuthenticationService,
        ContentService,
        NotificationService,
        NotificationProducer,
        UserProducer,
        HashtagService,
      ],
    }).compile();
    userService = app.get<UserService>(UserService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    controller = app.get<NotificationsController>(NotificationsController);
    notification = app.get<NotificationService>(NotificationService);
    const resultAccount = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th'],
    });
    const resultWrongAccount = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345789',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th'],
    });
    await authService.signupByEmail(resultAccount.accountDocument, {
      email: 'test@gmail.com',
      displayId: 'test1234',
      displayName: 'test',
      password: '1234AbcD',
    });
    userCredential = resultAccount.credentialDocument;
    wrongUserCredential = resultWrongAccount.credentialDocument;
    user = await userService.getUserFromCredential(
      resultAccount.credentialDocument
    );

    await buildMockData(notification, user, userCredential);
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('getNotification', () => {
    it('should return NotificationReponse that contain all notification default option all', async () => {
      const responseResult = await controller.getAll({
        $credential: userCredential,
      } as any);

      const expectResult = {
        payload: [
          {
            id: '',
            avatar: '',
            message: 'sample PROFILE',
            source: 'PROFILE',
            read: false,
            content: {
              id: null,
            },
            comment: {
              id: null,
            },
            system: {
              id: null,
            },
            type: 'system',
          },
          {
            id: '',
            avatar: '',
            message: 'sample PAGE',
            source: 'PAGE',
            read: false,
            content: {
              id: null,
            },
            comment: {
              id: '6138afa4f616a467b5c4eb72',
            },
            system: {
              id: null,
            },
            type: 'comment',
          },
          {
            id: '',
            avatar: '',
            message: 'sample PROFILE',
            source: 'PROFILE',
            read: false,
            content: {
              id: null,
            },
            comment: {
              id: '6138afa4f616a467b5c4eb72',
            },
            system: {
              id: null,
            },
            type: 'comment',
          },
        ],
      };

      responseResult.payload.forEach((x) => (x.id = ''));
      expect(responseResult.payload).toEqual(
        expect.arrayContaining(expectResult.payload)
      );
      expect(responseResult.payload.length).toEqual(3);
      expect(
        responseResult.payload.filter(({ comment }) => comment.id).length
      ).toEqual(2);
      expect(
        responseResult.payload.filter(
          (x) =>
            x.system.id == null && x.comment.id == null && x.content.id == null
        ).length
      ).toEqual(1);
    });

    it('should return NotificationReponse that contain all notification source page', async () => {
      const responseResult = await controller.getAll(
        {
          $credential: userCredential,
        } as any,
        null,
        null,
        null,
        NotificationSource.Page
      );
      const expectResult = {
        payload: [
          {
            id: '',
            avatar: '',
            message: 'sample PAGE',
            source: 'PAGE',
            read: false,
            content: {
              id: null,
            },
            comment: {
              id: '6138afa4f616a467b5c4eb72',
            },
            system: {
              id: null,
            },
            type: 'comment',
          },
        ],
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
        $credential: userCredential,
      } as any);

      const readNoti = allNotification.payload[0];
      await controller.notificationRead(readNoti.id, {
        $credential: userCredential,
      } as any);

      const result = await controller.getAll({
        $credential: userCredential,
      } as any);

      expect(
        result.payload.find((x) => x.id.toString() === readNoti.id.toString())
          .read
      ).toEqual(true);
    });

    it('should return Exception as expect', async () => {
      await controller.getAll({
        $credential: userCredential,
      } as any);

      await expect(
        controller.notificationRead('', {
          $credential: userCredential,
        } as any)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.NOTIFICATION_NOT_FOUND, 'th')
      );

      wrongUserCredential.account._id = '6138afa4f616a467b5c4eb72';
      await expect(
        controller.notificationRead('', {
          $credential: wrongUserCredential,
        } as any)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, 'th')
      );
    });
  });

  describe('notifications read all', () => {
    it('should success update all read status', async () => {
      console.log(userCredential.account._id);
      await controller.notificationReadAll({
        $credential: userCredential,
      } as any);

      const result = await controller.getAll({
        $credential: userCredential,
      } as any);

      expect(result.payload.filter((x) => x.read).length).toEqual(
        result.payload.length
      );
    });

    it('should return Exception as expect', async () => {
      await controller.getAll({
        $credential: userCredential,
      } as any);

      wrongUserCredential.account._id = '6138afa4f616a467b5c4eb72';
      await expect(
        controller.notificationReadAll({
          $credential: wrongUserCredential,
        } as any)
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, 'th')
      );
    });
  });

  describe('notifications register token', () => {
    it('should register token successful', async () => {
      const deviceID = 'iphone12345';
      const firebaseToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYxNDQ5';

      await controller.registerToken(
        {
          $credential: userCredential,
        } as any,
        {
          deviceUUID: deviceID,
          firebaseToken: firebaseToken,
        } as RegisterTokenDto
      );

      const credentailUpdate = await notification._credentialModel
        .findOne({ deviceUUID: deviceID })
        .exec();

      expect(credentailUpdate.firebaseNotificationToken).toEqual(firebaseToken);
    });

    it('should return Exception as expect', async () => {
      const deviceID = 'iphone12345';
      const firebaseToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYxNDQ5';
      await controller.getAll({
        $credential: userCredential,
      } as any);

      wrongUserCredential.account._id = '6138afa4f616a467b5c4eb72';
      await expect(
        controller.registerToken(
          {
            $credential: wrongUserCredential,
          } as any,
          {
            deviceUUID: deviceID,
            firebaseToken: firebaseToken,
          } as RegisterTokenDto
        )
      ).rejects.toEqual(
        new CastcleException(CastcleStatus.FORBIDDEN_REQUEST, 'th')
      );
    });
  });

  describe('notifications get badges', () => {
    it('should return empty badges', async () => {
      const expectResult = { payload: { badges: '' } };
      const result = await controller.badges({
        $credential: userCredential,
      } as any);
      expect(result).toEqual(expectResult);
    });

    it('should return badges value', async () => {
      await creatMockData(
        notification,
        user,
        NotificationSource.Profile,
        NotificationType.Comment,
        '6138afa4f616a467b5c4eb72',
        userCredential
      );
      const expectResult = { payload: { badges: '1' } };
      const result = await controller.badges({
        $credential: userCredential,
      } as any);
      expect(result).toEqual(expectResult);
    });

    it('should return badges value +99 ', async () => {
      for (let i = 0; i < 99; i++) {
        await creatMockData(
          notification,
          user,
          NotificationSource.Profile,
          NotificationType.Comment,
          '6138afa4f616a467b5c4eb72',
          userCredential
        );
      }
      const expectResult = { payload: { badges: '+99' } };
      const result = await controller.badges({
        $credential: userCredential,
      } as any);
      expect(result).toEqual(expectResult);
    });
  });
});
