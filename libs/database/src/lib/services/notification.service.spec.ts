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
  NotificationProducer,
  TopicName,
  UserProducer,
} from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseAsyncFeatures, MongooseForFeatures } from '../database.module';
import {
  CreateNotification,
  NotificationSource,
  NotificationType,
  RegisterTokenDto,
} from '../dtos/notification.dto';
import { env } from '../environment';
import { UserDocument } from '../schemas';
import { AccountDocument } from '../schemas/account.schema';
import { CredentialDocument } from '../schemas/credential.schema';
import { AuthenticationService } from './authentication.service';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

const fakeProcessor = jest.fn();
const fakeBull = BullModule.registerQueue({
  name: TopicName.Users,
  redis: {
    host: '0.0.0.0',
    port: 6380,
  },
  processors: [fakeProcessor],
});
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
        ...options,
      };
    },
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('NotificationService', () => {
  let service: NotificationService;
  let userService: UserService;
  let authService: AuthenticationService;
  let user: UserDocument;
  console.log('test in real db = ', env.DB_TEST_IN_DB);
  const importModules = env.DB_TEST_IN_DB
    ? [
        MongooseModule.forRoot(env.DB_URI, env.DB_OPTIONS),
        MongooseAsyncFeatures,
        MongooseForFeatures,
      ]
    : [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        BullModule.registerQueue({
          name: TopicName.Notifications,
          redis: {
            host: '0.0.0.0',
            port: 6380,
          },
          processors: [fakeProcessor],
        }),
        fakeBull,
      ];
  const providers = [
    ContentService,
    UserService,
    AuthenticationService,
    NotificationService,
    NotificationProducer,
    UserProducer,
    HashtagService,
  ];
  let result: {
    accountDocument: AccountDocument;
    credentialDocument: CredentialDocument;
  };

  let mockNewCredential: {
    accountDocument: AccountDocument;
    credentialDocument: CredentialDocument;
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers,
    }).compile();
    service = module.get<NotificationService>(NotificationService);
    userService = module.get<UserService>(UserService);
    authService = module.get<AuthenticationService>(AuthenticationService);
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

    const newNoti = new service._notificationModel({
      avatar: '',
      message: 'sample profile1',
      source: NotificationSource.Profile,
      sourceUserId: {
        _id: user._id,
      },
      type: NotificationType.Comment,
      targetRef: {
        _id: '6138afa4f616a467b5c4eb72',
      },
      read: false,
      account: {
        _id: result.accountDocument.id,
      },
    });
    await newNoti.save();

    const newNoti2 = new service._notificationModel({
      avatar: '',
      message: 'sample page2',
      source: NotificationSource.Page,
      sourceUserId: {
        _id: user._id,
      },
      type: NotificationType.Comment,
      targetRef: {
        _id: '6138afa4f616a467b5c4eb72',
      },
      read: false,
      account: {
        _id: result.accountDocument.id,
      },
    });
    await newNoti2.save();

    const newNoti3 = new service._notificationModel({
      avatar: '',
      message: 'sample page3',
      source: NotificationSource.Profile,
      sourceUserId: {
        _id: user._id,
      },
      type: NotificationType.System,
      targetRef: {
        _id: '6138afa4f616a467b5c4eb72',
      },
      read: false,
      account: {
        _id: result.accountDocument.id,
      },
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
    if (env.DB_TEST_IN_DB) await closeInMongodConnection();
  });

  describe('#getAll', () => {
    it('should get all notification in db with source as default option', async () => {
      const notification = await service.getAll(result.credentialDocument);
      expect(notification.items.length).toEqual(3);
    });

    it('should get all notification in db with source as page', async () => {
      const notification = await service.getAll(result.credentialDocument, {
        source: NotificationSource.Page,
      });
      expect(notification.items.length).toEqual(1);
      expect(notification.items[0].source).toEqual(NotificationSource.Page);
    });

    it('should get notification filter with sinceId in db', async () => {
      const notification = await service.getAll(result.credentialDocument);
      const filterId = notification.items[1].id;
      const notiResult = await service.getAll(result.credentialDocument, {
        sinceId: filterId,
      });
      expect(notiResult.items.length).toEqual(1);
      expect(notiResult.items[0].message).toEqual('sample page3');
    });

    it('should get notification filter with untilId in db', async () => {
      const notification = await service.getAll(result.credentialDocument);
      const filterId = notification.items[1].id;
      const notiResult = await service.getAll(result.credentialDocument, {
        untilId: filterId,
      });
      expect(notiResult.items.length).toEqual(1);
      expect(notiResult.items[0].message).toEqual('sample profile1');
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
    it('should get empty notification with empty data', async () => {
      const noti = await service.getFromId(null);
      expect(noti).toBeNull;
    });
  });

  describe('#flagReadAll', () => {
    it('should update read flag all notification in db', async () => {
      const resultUpdate = await service.flagReadAll(result.credentialDocument);
      const profileNoti = await service.getAll(result.credentialDocument);
      const pageNoti = await service.getAll(result.credentialDocument);

      expect(resultUpdate.n).toEqual(3);
      expect(profileNoti.items.filter((x) => x.read).length).toEqual(
        profileNoti.items.length
      );
      expect(pageNoti.items.filter((x) => x.read).length).toEqual(
        pageNoti.items.length
      );
    });

    it('should not update read flag notification in db with wrong credential', async () => {
      const resultUpdate = await service.flagReadAll(
        mockNewCredential.credentialDocument
      );
      expect(resultUpdate).toBeNull;
    });

    it('should not update read flag notification in db with empty credential', async () => {
      const resultUpdate = await service.flagReadAll(
        mockNewCredential.credentialDocument
      );
      expect(resultUpdate).toBeNull;
    });
  });

  describe('#notifyToUser', () => {
    it('should create new notification with type comment in db', async () => {
      const newNoti: CreateNotification = {
        message: 'sample page',
        source: NotificationSource.Profile,
        sourceUserId: {
          _id: user._id,
        },
        type: NotificationType.Comment,
        targetRef: {
          _id: '6138afa4f616a467b5c4eb72',
        },
        read: false,
        account: {
          _id: result.accountDocument.id,
        },
      };

      const resultData = await service.notifyToUser(newNoti);
      await service.getAll(result.credentialDocument);

      expect(resultData).toBeDefined();
      expect(resultData.message).toEqual(newNoti.message);
      expect(resultData.source).toEqual(newNoti.source);
      expect(resultData.sourceUserId._id).toEqual(newNoti.sourceUserId._id);
      expect(resultData.type).toEqual(newNoti.type);
      expect(resultData.targetRef.$ref).toEqual(NotificationType.Comment);
      expect(resultData.targetRef.$id).toEqual(newNoti.targetRef._id);
      expect(resultData.read).toEqual(newNoti.read);
      expect(resultData.account._id.toString()).toEqual(newNoti.account._id);
    });

    it('should create new notification with type system in db', async () => {
      const newNoti: CreateNotification = {
        message: 'sample page',
        source: NotificationSource.Profile,
        sourceUserId: {
          _id: user._id,
        },
        type: NotificationType.System,
        targetRef: {
          _id: '6138afa4f616a467b5c4eb72',
        },
        read: false,
        account: {
          _id: result.accountDocument.id,
        },
      };

      const resultData = await service.notifyToUser(newNoti);
      await service.getAll(result.credentialDocument);

      expect(resultData).toBeDefined();
      expect(resultData.message).toEqual(newNoti.message);
      expect(resultData.source).toEqual(newNoti.source);
      expect(resultData.sourceUserId._id).toEqual(newNoti.sourceUserId._id);
      expect(resultData.type).toEqual(newNoti.type);
      expect(resultData.targetRef.$ref).toBeNull();
      expect(resultData.read).toEqual(newNoti.read);
      expect(resultData.account._id.toString()).toEqual(newNoti.account._id);
    });
  });

  describe('#registerToken', () => {
    it('should update firebase token fron device uuid in db', async () => {
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

      const updateToken = await service.registerToken(registerData);
      console.log(updateToken);
      const credentailUpdate = await service._credentialModel
        .findOne({ deviceUUID: deviceID })
        .exec();

      expect(credentailUpdate.firebaseNotificationToken).toEqual(firebaseToken);
    });

    it('should get empty result with empty data', async () => {
      const updateToken = await service.registerToken(null);
      expect(updateToken).toBeNull();
    });
  });

  describe('#badges', () => {
    it('should return total notification number when lower than 99', async () => {
      const badges = await service.getBadges(result.credentialDocument);
      expect(badges).toEqual('2');
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
      const badges = await service.getBadges(credentialData.credentialDocument);
      expect(badges).toBeNull;
    });

    it('should return total notification number when more than 99', async () => {
      for (let i = 0; i < 99; i++) {
        const newNoti = new service._notificationModel({
          avatar: '',
          message: 'sample profile' + i,
          source: NotificationSource.Profile,
          sourceUserId: {
            _id: user._id,
          },
          type: NotificationType.Comment,
          targetRef: {
            id: '6138afa4f616a467b5c4eb72',
          },
          read: false,
          account: {
            _id: result.accountDocument.id,
          },
        });
        await newNoti.save();
      }

      const badges = await service.getBadges(result.credentialDocument);
      expect(badges).toEqual('+99');
    });
  });
});
