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
import { CastcleMongooseModule } from '@castcle-api/environments';
import { CreatedUser, TestingModule } from '@castcle-api/testing';
import { Downloader } from '@castcle-api/utils/aws';
import {
  FacebookClient,
  GoogleClient,
  Mailer,
  TwilioClient,
  TwitterClient,
} from '@castcle-api/utils/clients';
import { HttpModule } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { Repository } from 'libs/database/src/lib/repositories';
import {
  AnalyticService,
  AuthenticationServiceV2,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  SocialSyncServiceV2,
  UserServiceV2,
} from '../database.module';
import {
  NotificationQuery,
  NotificationRef,
  NotificationSource,
  NotificationType,
} from '../dtos/notification.dto';
import { ContentType, QueueName } from '../models';
import { Comment, Content, Notification } from '../schemas';
import { ContentService } from './content.service';
import { HashtagService } from './hashtag.service';
import { NotificationServiceV2 } from './notification.service.v2';

describe('NotificationServiceV2', () => {
  let moduleRef: TestingModule;
  let service: NotificationServiceV2;
  let comment: Comment;
  let content: Content;
  let contentService: ContentService;
  let mocksUsers: CreatedUser[];
  let notification: Notification[];
  let repository: Repository;

  beforeAll(async () => {
    moduleRef = await TestingModule.createWithDb({
      imports: [
        CacheModule.register(),
        CastcleMongooseModule,
        MongooseAsyncFeatures(),
        MongooseForFeatures(),
        HttpModule,
      ],
      providers: [
        AuthenticationServiceV2,
        ContentService,
        HashtagService,
        NotificationServiceV2,
        Repository,
        UserServiceV2,
        { provide: SocialSyncServiceV2, useValue: {} },
        { provide: Downloader, useValue: {} },
        { provide: AnalyticService, useValue: {} },
        { provide: FacebookClient, useValue: {} },
        { provide: GoogleClient, useValue: {} },
        { provide: Mailer, useValue: {} },
        { provide: TwilioClient, useValue: {} },
        { provide: TwitterClient, useValue: {} },
        {
          provide: getQueueToken(QueueName.CONTENT),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.REPORTING),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.USER),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.VERIFY_EMAIL),
          useValue: { add: jest.fn() },
        },
      ],
    });

    contentService = moduleRef.get(ContentService);
    service = moduleRef.get(NotificationServiceV2);
    repository = moduleRef.get(Repository);
  });

  afterAll(() => {
    return moduleRef.close();
  });

  beforeEach(async () => {
    await moduleRef.cleanDb();
    mocksUsers = await moduleRef.createUsers(3);

    const user = mocksUsers[0].user;
    content = await contentService.createContentFromUser(user, {
      payload: { message: 'content #1' },
      type: ContentType.Short,
      castcleId: user.displayId,
    });

    comment = await contentService.createCommentForContent(user, content, {
      message: 'comment #1',
    });

    await contentService.replyComment(user, comment, {
      message: 'reply comment #1',
    });
    const notify_1 = await repository.createNotification({
      source: NotificationSource.Profile,
      sourceUserId: mocksUsers[1].user._id,
      type: NotificationType.Comment,
      contentRef: content._id,
      commentRef: comment._id,
      read: false,
      account: mocksUsers[0].account._id,
      user: mocksUsers[0].user._id,
    });

    const notify_2 = await repository.createNotification({
      source: NotificationSource.Profile,
      sourceUserId: mocksUsers[1].user._id,
      type: NotificationType.Follow,
      profileRef: mocksUsers[0].user._id,
      read: false,
      account: mocksUsers[0].account._id,
      user: mocksUsers[0].user._id,
    });

    notification = [notify_1, notify_2];
  });

  describe('checkNotify', () => {
    it('checking the notification type is disabled in the environment', async () => {
      const notify = await repository.findNotification({
        commentRef: comment._id,
        type: NotificationType.Comment,
        account: mocksUsers[0].account._id,
      });

      const isNotify = service.checkNotify(notify);
      expect(isNotify).toEqual(false);
    });
  });

  describe('generateMessageByType', () => {
    it('generate message by type notification and language default.', async () => {
      const notify = await repository.findNotification({
        commentRef: comment._id,
        type: NotificationType.Comment,
        account: mocksUsers[0].account._id,
      });

      const newMessage = (service as any).generateMessageByType(
        notify,
        [mocksUsers[1].user.displayName],
        'en',
        mocksUsers[0].user,
      );

      expect(newMessage).toEqual(
        `${mocksUsers[1].user.displayId} commented on your cast.`,
      );
    });

    it('generate message by type notification and language thai.', async () => {
      const notify = await repository.findNotification({
        commentRef: comment._id,
        type: NotificationType.Comment,
        account: mocksUsers[0].account._id,
      });

      const newMessage = (service as any).generateMessageByType(
        notify,
        [mocksUsers[1].user.displayName],
        'th',
        mocksUsers[0].user,
      );

      expect(newMessage).toEqual(
        `${mocksUsers[1].user.displayId} แสดงความคิดเห็นบน cast ของคุณ`,
      );
    });
  });

  describe('checkNotificationTypePage', () => {
    it('checking notification type comment to redirect page is exist.', async () => {
      const notify = await repository.findNotification({
        commentRef: comment._id,
        type: NotificationType.Comment,
        account: mocksUsers[0].account._id,
      });

      const landingPage = (service as any).checkNotificationTypePage(
        notify.type,
        notify.commentRef
          ? NotificationRef.Comment
          : notify.contentRef
          ? NotificationRef.Content
          : undefined,
      );
      expect(landingPage).toEqual('comment');
    });

    it('checking notification type followed to redirect page is exist.', async () => {
      const notify = await repository.findNotification({
        profileRef: mocksUsers[0].user._id,
        type: NotificationType.Follow,
        account: mocksUsers[0].account._id,
      });

      const landingPage = (service as any).checkNotificationTypePage(
        notify.type,
        notify.commentRef
          ? NotificationRef.Comment
          : notify.contentRef
          ? NotificationRef.Content
          : undefined,
      );
      expect(landingPage).toEqual('follower');
    });
  });

  describe('getFromId', () => {
    it('should get notification data is exists.', async () => {
      const notify = await repository.findNotification({
        profileRef: mocksUsers[0].user._id,
        type: NotificationType.Follow,
        account: mocksUsers[0].account._id,
      });
      const notifyBy = await service.getFromId(notify._id);

      expect(notifyBy.sourceUserId).toContainEqual(mocksUsers[1].user._id);
      expect(notifyBy.source).toEqual(NotificationSource.Profile);
      expect(notifyBy.type).toEqual(NotificationType.Follow);
      expect(notifyBy.profileRef).toEqual(mocksUsers[0].user._id);
      expect(notifyBy.account).toEqual(mocksUsers[0].account._id);
    });
  });
  describe('getAllNotify', () => {
    it('should get all notification data is exists.', async () => {
      const notifies = await service.getAllNotify(mocksUsers[0].account, {
        maxResults: 100,
      } as NotificationQuery);

      expect(notifies).toHaveLength(2);
      expect(notifies).toBeDefined();

      expect(notifies[0].source).toEqual(NotificationSource.Profile);
      expect(notifies[0].type).toEqual(NotificationType.Follow);
      expect(notifies[0].account).toEqual(mocksUsers[0].account._id);

      expect(notifies[1].source).toEqual(NotificationSource.Profile);
      expect(notifies[1].type).toEqual(NotificationType.Comment);
      expect(notifies[1].account).toEqual(mocksUsers[0].account._id);
    });
  });

  describe('getBadges', () => {
    it('should get count by notification unread is exists', async () => {
      const notifyBadges = await service.getBadges(mocksUsers[0].account);

      expect(notifyBadges.profile).toEqual(2);
      expect(notifyBadges.page).toEqual(0);
      expect(notifyBadges.system).toEqual(0);
    });
  });

  describe('readNotify', () => {
    it('should update notification read equal true.', async () => {
      await service.readNotify(notification[0]._id);

      const notifyBy = await service.getFromId(notification[0]._id);

      expect(notifyBy.read).toEqual(true);
      expect(notifyBy.type).toEqual(NotificationType.Comment);
      expect(notifyBy.account).toEqual(mocksUsers[0].account._id);
    });
  });

  describe('readAllSourceNotify', () => {
    it('should update all notification read equal true.', async () => {
      await service.readAllSourceNotify(
        mocksUsers[0].account,
        NotificationSource.Profile,
      );

      const notifies = await service.getAllNotify(mocksUsers[0].account, {
        maxResults: 100,
      } as NotificationQuery);

      expect(notifies).toHaveLength(2);
      expect(notifies).toBeDefined();

      notifies.forEach((item) => {
        expect(item.read).toEqual(true);
        expect(item.account).toEqual(mocksUsers[0].account._id);
      });
    });
  });
  describe('generateMessage', () => {
    it('should generate message notification by language default is correct.', async () => {
      const notify = await repository.findNotification({
        profileRef: mocksUsers[0].user._id,
        type: NotificationType.Follow,
        account: mocksUsers[0].account._id,
      });
      const { message } = await service.generateMessage(
        notify,
        mocksUsers[0].user,
        'en',
      );
      expect(message).toBeDefined();
      expect(message).toEqual(
        `${mocksUsers[1].user.displayId} started following you.`,
      );
    });

    it('should generate message notification by language thai is correct.', async () => {
      const notify = await repository.findNotification({
        profileRef: mocksUsers[0].user._id,
        type: NotificationType.Follow,
        account: mocksUsers[0].account._id,
      });
      const { message } = await service.generateMessage(
        notify,
        mocksUsers[0].user,
        'th',
      );

      expect(message).toBeDefined();
      expect(message).toEqual(`${mocksUsers[1].user.displayId} ได้ติดตามคุณ`);
    });
  });

  describe('generateNotificationsResponse', () => {
    it('should generate message notification response by language default is correct.', async () => {
      const notifies = await repository.findNotifications({
        account: mocksUsers[0].account._id,
      });

      const notifyResp = await service.generateNotificationsResponse(
        notifies,
        'en',
      );

      notifyResp.forEach((item) => {
        if (item.type === NotificationType.Comment) {
          expect(item.message).toEqual(
            `${mocksUsers[1].user.displayId} commented on your cast.`,
          );
        } else {
          expect(item.message).toEqual(
            `${mocksUsers[1].user.displayId} started following you.`,
          );
        }
      });
    });
    it('should generate message notification response by language thai is correct.', async () => {
      const notifies = await repository.findNotifications({
        account: mocksUsers[0].account._id,
      });

      const notifyResp = await service.generateNotificationsResponse(
        notifies,
        'th',
      );

      expect(notifyResp).toBeDefined();
      notifyResp.forEach((item) => {
        if (item.type === NotificationType.Comment) {
          expect(item.message).toEqual(
            `${mocksUsers[1].user.displayId} แสดงความคิดเห็นบน cast ของคุณ`,
          );
        } else {
          expect(item.message).toEqual(
            `${mocksUsers[1].user.displayId} ได้ติดตามคุณ`,
          );
        }
      });
    });
  });

  describe('deleteNotify', () => {
    it('should delete notification by id is correct.', async () => {
      await service.deleteNotify(notification[0]._id);

      const notify = await service.getFromId(notification[0]._id);

      expect(notify).toBeNull();
    });
  });

  describe('getAllNotify', () => {
    it('should delete all notification by source is correct.', async () => {
      await service.deleteAllSourceNotify(
        mocksUsers[0].account,
        NotificationSource.Profile,
      );

      const notifies = await service.getAllNotify(mocksUsers[0].account, {
        maxResults: 100,
      } as NotificationQuery);

      expect(notifies).toHaveLength(0);
    });
  });
});
