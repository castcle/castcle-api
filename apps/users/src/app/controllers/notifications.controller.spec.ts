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
  Credential,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  NotificationService,
  NotificationSource,
  NotificationType,
  QueueName,
  RegisterTokenDto,
  User,
  UserService,
} from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common/cache';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NotificationsController } from './notifications.controller';

const buildMockData = async (
  notification: NotificationService,
  user: User,
  userCredential: Credential,
) => {
  await creatMockData(
    notification as any,
    user,
    NotificationSource.Profile,
    NotificationType.Comment,
    '6138afa4f616a467b5c4eb72',
    userCredential,
  );

  await creatMockData(
    notification as any,
    user,
    NotificationSource.Page,
    NotificationType.Comment,
    '6138afa4f616a467b5c4eb72',
    userCredential,
  );

  await creatMockData(
    notification as any,
    user,
    NotificationSource.Profile,
    NotificationType.System,
    '6138afa4f616a467b5c4eb72',
    userCredential,
  );
};

const creatMockData = async (
  notification: NotificationService,
  user: User,
  sourceType: NotificationSource,
  typeNoti: NotificationType,
  docRefId: string,
  userCredential: Credential,
) => {
  const newNotification = new (notification as any)._notificationModel({
    avatar: '',
    source: sourceType,
    sourceUserId: user,
    type: typeNoti,
    contentRef: undefined,
    read: false,
    account: {
      _id: userCredential.account._id,
    },
  });
  await newNotification.save();
};

describe('NotificationsController', () => {
  let mongod: MongoMemoryServer;
  let controller: NotificationsController;
  let app: TestingModule;
  let userService: UserService;
  let authService: AuthenticationService;
  let userCredential: Credential;
  let wrongUserCredential: Credential;
  let notification: NotificationService;
  let user: User;

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
      controllers: [NotificationsController],
      providers: [
        UserService,
        AuthenticationService,
        ContentService,
        NotificationService,
        HashtagService,
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
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
      resultAccount.credentialDocument,
    );

    await buildMockData(notification, user, userCredential);
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('getNotification', () => {
    it('should return NotificationResponse that contain all notification default option all', async () => {
      const responseResult = await controller.getAll(
        {
          $credential: userCredential,
        } as any,
        null,
        null,
      );

      expect(responseResult.payload).toHaveLength(3);
      expect(
        responseResult.payload.filter(
          (x) =>
            !x.commentId ||
            !x.contentId ||
            !x.replyId ||
            !x.advertiseId ||
            !x.systemId ||
            !x.profileId,
        ).length,
      ).toEqual(3);
    });

    it('should return NotificationResponse that contain all notification source page', async () => {
      const responseResult = await controller.getAll(
        {
          $credential: userCredential,
        } as any,
        null,
        NotificationSource.Page,
      );

      const expectResult = {
        payload: [
          {
            advertiseId: undefined,
            commentId: undefined,
            contentId: undefined,
            profileId: undefined,
            systemId: undefined,
            landingPage: undefined,
            read: false,
            type: 'comment',
            id: 'test',
            message: 'test commented on your cast',
            replyId: undefined,
            source: 'page',
          },
        ],
      };
      responseResult.payload.map((item) => {
        item.id = 'test';
        delete item.avatar;
        delete item.createdAt;
        delete item.updatedAt;
      });

      expect(responseResult.payload).toEqual(expectResult.payload);
      expect(responseResult.payload).toHaveLength(1);
    });
  });

  describe('notifications read', () => {
    it('should success update read status', async () => {
      const allNotification = await controller.getAll(
        {
          $credential: userCredential,
        } as any,
        null,
        null,
      );

      const readNoti = allNotification.payload[0];
      await controller.notificationRead(
        {
          $credential: userCredential,
        } as any,
        readNoti.id,
      );

      const result = await (notification as any)._notificationModel.findById(
        readNoti.id,
      );

      expect(result.read).toEqual(true);
    });

    it('should return Exception as expect', async () => {
      await controller.getAll(
        {
          $credential: userCredential,
        } as any,
        null,
        null,
      );

      await expect(
        controller.notificationRead(
          {
            $credential: userCredential,
          } as any,
          '',
        ),
      ).rejects.toEqual(new CastcleException('NOTIFICATION_NOT_FOUND'));

      await expect(
        controller.notificationRead(
          {
            $credential: wrongUserCredential,
          } as any,
          '',
        ),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
    });
  });

  describe('notifications read all', () => {
    it('should success update all read status', async () => {
      await controller.notificationReadAll({
        $credential: userCredential,
      } as any);

      const result = await controller.getAll(
        {
          $credential: userCredential,
        } as any,
        null,
        null,
      );

      const notificationList = await (
        notification as any
      )._notificationModel.find();

      expect(notificationList.filter((x) => x.read).length).toEqual(
        result.payload.length,
      );
    });

    it('should return Exception as expect', async () => {
      await controller.getAll(
        {
          $credential: userCredential,
        } as any,
        null,
        null,
      );

      await expect(
        controller.notificationReadAll({
          $credential: wrongUserCredential,
        } as any),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
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
        } as RegisterTokenDto,
      );

      const credentailUpdate = await (notification as any)._credentialModel
        .findOne({ deviceUUID: deviceID })
        .exec();

      expect(credentailUpdate.firebaseNotificationToken).toEqual(firebaseToken);
    });

    it('should return Exception as expect', async () => {
      const deviceID = 'iphone12345';
      const firebaseToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYxNDQ5';
      await controller.getAll(
        {
          $credential: userCredential,
        } as any,
        null,
        null,
      );

      await expect(
        controller.registerToken(
          {
            $credential: wrongUserCredential,
          } as any,
          {
            deviceUUID: deviceID,
            firebaseToken: firebaseToken,
          } as RegisterTokenDto,
        ),
      ).rejects.toEqual(new CastcleException('FORBIDDEN'));
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
        userCredential,
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
          userCredential,
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
