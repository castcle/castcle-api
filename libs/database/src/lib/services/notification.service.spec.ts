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
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import {
  CreateNotification,
  NotificationSource,
  NotificationType,
  RegisterTokenDto,
} from '../dtos/notification.dto';
import { QueueName } from '../models';
import { Account, Credential, User } from '../schemas';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

describe('NotificationService', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: NotificationService;
  let userService: UserService;
  let authService: AuthenticationService;
  let user: User;

  let result: {
    accountDocument: Account;
    credentialDocument: Credential;
  };

  let mockNewCredential: {
    accountDocument: Account;
    credentialDocument: Credential;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        MongooseModule.forRoot(mongod.getUri()),
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
      ],
      providers: [
        ContentService,
        UserService,
        AuthenticationService,
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

    service = moduleRef.get<NotificationService>(NotificationService);
    userService = moduleRef.get<UserService>(UserService);
    authService = moduleRef.get<AuthenticationService>(AuthenticationService);
    result = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'ifong',
    });
    //sign up to create actual account
    await authService.signupByEmail(result.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567',
    });
    user = await userService.getUserFromCredential(result.credentialDocument);

    const newNoti = new (service as any)._notificationModel({
      message: 'sample profile1',
      source: NotificationSource.Profile,
      sourceUserId: user._id,

      type: NotificationType.Comment,
      targetRef: {
        _id: '6138afa4f616a467b5c4eb72',
        ref: 'content',
      },
      read: false,
      account: result.accountDocument.id,
    });
    await newNoti.save();

    const newNoti2 = new (service as any)._notificationModel({
      message: 'sample page2',
      source: NotificationSource.Page,
      sourceUserId: user._id,

      type: NotificationType.Like,
      targetRef: {
        _id: '6138afa4f616a467b5c4eb72',
        ref: 'content',
      },
      read: false,
      account: result.accountDocument.id,
    });
    await newNoti2.save();

    const newNoti3 = new (service as any)._notificationModel({
      avatar: '',
      message: 'sample page3',
      source: NotificationSource.Profile,
      sourceUserId: user._id,
      type: NotificationType.System,
      targetRef: {
        _id: '6138afa4f616a467b5c4eb72',
        ref: 'system',
      },
      read: false,
      account: result.accountDocument.id,
    });
    await newNoti3.save();

    mockNewCredential = await authService.createAccount({
      deviceUUID: 'test123545',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios',
      },
      device: 'iPhone',
    });
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('#getNotificationAll', () => {
    it('should get all notification in db with source as default option', async () => {
      const notification = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );
      expect(notification).toHaveLength(3);
    });

    it('should get all notification in db with source as page', async () => {
      const notification = await service.getNotificationAll(
        result.credentialDocument,
        {
          source: NotificationSource.Page,
          hasRelationshipExpansion: false,
        },
      );
      expect(notification).toHaveLength(1);
      expect(notification[0].source).toEqual(NotificationSource.Page);
    });

    it('should get notification filter with sinceId in db', async () => {
      const notification = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );
      const filterId = notification[1].id;
      const notiResult = await service.getNotificationAll(
        result.credentialDocument,
        {
          sinceId: filterId,
          source: NotificationSource.System,
          hasRelationshipExpansion: false,
        },
      );
      expect(notiResult).toHaveLength(0);
    });

    it('should get notification filter with untilId in db', async () => {
      const notification = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );
      const filterId = notification[1].id;
      const notiResult = await service.getNotificationAll(
        result.credentialDocument,
        {
          untilId: filterId,
          source: NotificationSource.Profile,
          hasRelationshipExpansion: false,
        },
      );

      expect(notiResult).toHaveLength(1);
    });
  });

  describe('#getFromId', () => {
    it('should get notification in db with id', async () => {
      const allNotification = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );
      const notification = await service.getFromId(allNotification[0].id);
      expect(notification).toEqual(allNotification[0]);
      expect(notification).not.toEqual(allNotification[1]);
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
      const allNotification = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );
      const updateRead = allNotification[0];
      const notificationId = updateRead.id;

      await service.flagRead(updateRead);
      const noti = await service.getFromId(notificationId);

      expect(noti.read).toEqual(true);
    });
    it('should get empty notification with empty data', async () => {
      const noti = await service.getFromId(null);
      expect(noti).toBeNull();
    });
  });

  describe('#flagReadAll', () => {
    it('should update read flag all notification in db', async () => {
      const resultUpdate = await service.flagReadAll(result.credentialDocument);
      const profileNoti = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );
      const pageNoti = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );

      expect(resultUpdate.n).toEqual(3);
      expect(profileNoti.filter((x) => x.read).length).toEqual(
        profileNoti.length,
      );
      expect(pageNoti.filter((x) => x.read).length).toEqual(pageNoti.length);
    });

    it('should not update read flag notification in db with wrong credential', async () => {
      const resultUpdate = await service.flagReadAll(
        mockNewCredential.credentialDocument,
      );
      expect(resultUpdate).toBeNull;
    });

    it('should not update read flag notification in db with empty credential', async () => {
      const resultUpdate = await service.flagReadAll(
        mockNewCredential.credentialDocument,
      );
      expect(resultUpdate).toBeNull;
    });
  });

  describe('#notifyToUser', () => {
    it('should create new notification with type comment in db', async () => {
      const newNoti: CreateNotification = {
        source: NotificationSource.Profile,
        sourceUserId: user._id,
        type: NotificationType.Comment,
        contentRef: Types.ObjectId('6138afa4f616a467b5c4eb72'),
        read: false,
        account: result.accountDocument.id,
      };
      const userOwner = await userService.getUserAndPagesFromAccountId(
        result.accountDocument.id,
      );

      await service.notifyToUser(newNoti, userOwner[0], 'th');

      const notifyData = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );

      expect(notifyData).toBeDefined();
      expect(notifyData[0].source).toEqual(newNoti.source);
      expect(notifyData[0].sourceUserId[0]).toEqual(newNoti.sourceUserId);
      expect(notifyData[0].type).toEqual(newNoti.type);
      expect(notifyData[0].account.toString()).toEqual(newNoti.account);
    });

    it('should create new notification with type system in db', async () => {
      const newNoti: CreateNotification = {
        source: NotificationSource.Profile,
        sourceUserId: user._id,
        type: NotificationType.System,
        read: false,
        account: result.accountDocument.id,
      };
      const userOwner = await userService.getUserAndPagesFromAccountId(
        result.accountDocument.id,
      );

      await service.notifyToUser(newNoti, userOwner[0], 'th');

      const notifyData = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );

      expect(notifyData).toBeDefined();
      expect(notifyData[0].source).toEqual(newNoti.source);
      expect(notifyData[0].sourceUserId[0]).toEqual(newNoti.sourceUserId);
      expect(notifyData[0].account.toString()).toEqual(newNoti.account);
    });
  });

  describe('#registerToken', () => {
    it('should update firebase token from device uuid in db', async () => {
      const deviceID = '9999999999';
      const firebaseToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYxNDQ5';
      await authService.createAccount({
        deviceUUID: deviceID,
        languagesPreferences: ['th', 'th'],
        header: {
          platform: 'ios',
        },
        device: 'iPhone13',
      });

      const registerData = new RegisterTokenDto();
      registerData.deviceUUID = deviceID;
      registerData.firebaseToken = firebaseToken;

      await service.registerToken(registerData);
      const credentailUpdate = await (service as any)._credentialModel
        .findOne({ deviceUUID: deviceID })
        .exec();

      expect(credentailUpdate.firebaseNotificationToken).toEqual(firebaseToken);
    });
  });

  describe('#badges', () => {
    it('should return total notification number when lower than 99', async () => {
      await new (service as any)._notificationModel({
        account: result.credentialDocument.account._id,
        source: 'profile',
        type: 'like',
        read: false,
      }).save();

      const badges = await (service as any).getBadges(
        result.credentialDocument,
      );

      expect(badges).toEqual('1');
    });

    it('should return expty notification when get empty notification', async () => {
      const credentialData = await authService.createAccount({
        deviceUUID: '456775345',
        languagesPreferences: ['th', 'th'],
        header: {
          platform: 'ios',
        },
        device: 'iPhone13',
      });
      const badges = await (service as any).getBadges(
        credentialData.credentialDocument,
      );
      console.log(badges);

      expect(badges).toBeDefined();
    });

    it('should return total notification number when more than 99', async () => {
      for (let i = 0; i < 101; i++) {
        const newNoti = new (service as any)._notificationModel({
          message: 'sample profile' + i,
          source: NotificationSource.Profile,
          sourceUserId: user._id,
          type: NotificationType.Comment,
          targetRef: {
            id: '6138afa4f616a467b5c4eb72',
          },
          read: false,
          account: result.accountDocument.id,
        });
        await newNoti.save();
      }

      const badges = await (service as any).getBadges(
        result.credentialDocument,
      );
      expect(badges).toEqual('+99');
    });
  });

  describe('#generateNotificationToMessage', () => {
    it('should create notification message in db', async () => {
      const notification = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );
      const userOwner = await userService.getUserAndPagesFromAccountId(
        result.accountDocument.id,
      );

      const message = await (service as any).generateMessage(
        userOwner,
        notification[0],
        'th',
      );

      expect(message).toEqual('sp002 แสดงความคิดเห็นบน cast ของคุณ');
    });
  });
  describe('#generateMessagesToNotifications', () => {
    it('should create notification messages in db', async () => {
      const notification = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );

      const message = await (service as any).generateMessagesToNotifications(
        notification,
        'th',
      );

      expect(message).toHaveLength(105);
    });
  });
  describe('#generateNotification', () => {
    it('should create notification messages in db', async () => {
      const notification = await service.getNotificationAll(
        result.credentialDocument,
        { hasRelationshipExpansion: false },
      );
      const userOwner = await userService.getUserAndPagesFromAccountId(
        result.accountDocument.id,
      );
      const message = await (service as any).generateMessage(
        userOwner,
        notification[0],
        'th',
      );
      const deviceID = '9999999999';
      const firebaseToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYxNDQ5';
      await (service as any)
        ._accountDeviceModel({
          uuid: deviceID,
          firebaseToken: firebaseToken,
          platform: 'ios',
          account: result.accountDocument.id,
        })
        .save();
      const firebaseTokens = await (service as any)._accountDeviceModel.find({
        uuid: deviceID,
      });

      const payloadNotify = await (service as any).generateNotification(
        message,
        notification[0],
        firebaseTokens,
      );

      expect(payloadNotify.firebaseTokens[0]).toEqual(firebaseToken);
      expect(payloadNotify.aps.alert).toEqual(message);
      expect(String(payloadNotify.payload.id)).toEqual(
        String(notification[0].id),
      );
    });
  });
});
