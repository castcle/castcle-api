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

import { Configs, Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CastcleImage } from '@castcle-api/utils/aws';
import { CastcleDate, CastcleLocalization } from '@castcle-api/utils/commons';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { pipelineNotificationBadge } from '../aggregations';
import {
  AndroidMessagePriority,
  CreateNotification,
  NotificationLandingPage,
  NotificationPayloadDto,
  NotificationQuery,
  NotificationRef,
  NotificationSource,
  NotificationType,
  PushNotificationPayload,
  SoundDeviceDefault,
} from '../dtos';
import { NotificationMessage, QueueName, UserType } from '../models';
import { Repository } from '../repositories';
import { Account, Notification, User } from '../schemas';

@Injectable()
export class NotificationServiceV2 {
  #logger = new CastLogger(NotificationServiceV2.name);

  constructor(
    @InjectQueue(QueueName.NOTIFICATION)
    private notificationQueue: Queue<NotificationMessage>,
    private repository: Repository,
  ) {}

  private checkNotify = (notificationData: CreateNotification) => {
    switch (notificationData.type) {
      case NotificationType.Like:
        return Environment.NOTIFY_LIKE == '1';
      case NotificationType.Recast:
        return Environment.NOTIFY_RECAST == '1';
      case NotificationType.Quote:
        return Environment.NOTIFY_QUOTE == '1';
      case NotificationType.Comment:
        return Environment.NOTIFY_COMMENT == '1';
      case NotificationType.Farm:
        return Environment.NOTIFY_FARM == '1';
      case NotificationType.Reply:
        return Environment.NOTIFY_REPLY == '1';
      case NotificationType.Tag:
        return Environment.NOTIFY_TAG == '1';
      case NotificationType.System:
        return Environment.NOTIFY_SYSTEM == '1';
      default:
        return Environment.NOTIFY_FOLLOW == '1';
    }
  };

  private checkNotificationTypePage = (
    type: NotificationType,
    targetRef?: string,
  ) => {
    if (
      (type === NotificationType.Like &&
        targetRef === NotificationRef.Content) ||
      type === NotificationType.Recast ||
      type === NotificationType.Quote
    ) {
      return NotificationLandingPage.Cast;
    } else if (
      (type === NotificationType.Like &&
        targetRef === NotificationRef.Comment) ||
      type === NotificationType.Comment ||
      type === NotificationType.Reply
    ) {
      return NotificationLandingPage.Comment;
    } else if (type === NotificationType.Follow) {
      return NotificationLandingPage.Follower;
    } else {
      return;
    }
  };

  private generateMessageByType = (
    notify: Notification,
    displayNames: string[],
    language: string,
    user?: User,
  ) => {
    switch (notify.type) {
      case NotificationType.Like:
        if (notify.commentRef) {
          return CastcleLocalization.getTemplateLikeComment(
            language,
            displayNames,
            user?.type === UserType.PAGE ? user.displayName : '',
          );
        } else {
          return CastcleLocalization.getTemplateLike(
            language,
            displayNames,
            user?.type === UserType.PAGE ? user.displayName : '',
          );
        }

      case NotificationType.Comment:
        return CastcleLocalization.getTemplateComment(
          language,
          displayNames,
          user?.type === UserType.PAGE ? user.displayName : '',
        );

      case NotificationType.Farm:
        return CastcleLocalization.getTemplateFarm(
          language,
          displayNames,
          user?.type === UserType.PAGE ? user.displayName : '',
        );

      case NotificationType.Quote:
        return CastcleLocalization.getTemplateQuote(
          language,
          displayNames,
          user?.type === UserType.PAGE ? user.displayName : '',
        );

      case NotificationType.Recast:
        return CastcleLocalization.getTemplateRecast(
          language,
          displayNames,
          user?.type === UserType.PAGE ? user.displayName : '',
        );

      case NotificationType.Reply:
        return CastcleLocalization.getTemplateReply(
          language,
          displayNames,
          user?.type === UserType.PAGE ? user.displayName : '',
        );

      case NotificationType.Tag:
        return CastcleLocalization.getTemplateTag(
          language,
          displayNames,
          user?.type === UserType.PAGE ? user.displayName : '',
        );

      case NotificationType.System:
        return CastcleLocalization.getTemplateSystem(language, displayNames);

      case NotificationType.AdsApprove:
        return CastcleLocalization.getTemplateAdsApprove(language);

      case NotificationType.AdsDecline:
        return CastcleLocalization.getTemplateAdsDecline(language);

      case NotificationType.IllegalDone:
        return CastcleLocalization.getTemplateIllegalDone(language);

      case NotificationType.IllegalClosed:
        return CastcleLocalization.getTemplateIllegalClosed(language);

      case NotificationType.NotIllegal:
        return CastcleLocalization.getTemplateNotIllegal(language);

      default:
        return CastcleLocalization.getTemplateFollow(
          language,
          displayNames,
          user?.type === UserType.PAGE ? user.displayName : '',
        );
    }
  };

  private generateMessage = async (
    notify: Notification,
    requestedBy: User,
    language: string,
  ) => {
    const userSort = [];

    if (
      [
        NotificationType.AdsApprove,
        NotificationType.AdsDecline,
        NotificationType.IllegalDone,
        NotificationType.IllegalClosed,
        NotificationType.NotIllegal,
      ].every((type) => type !== notify.type)
    ) {
      this.#logger.log('Reverse latest user.');

      const reverseUserIds = notify.sourceUserId?.reverse();

      this.#logger.log('Get user data.');

      const users = await this.repository.findUsers({
        _id: reverseUserIds,
      });

      users.forEach((user) => {
        const index = reverseUserIds.indexOf(user._id);
        if (index > -1) {
          userSort[index] = user;
          reverseUserIds.splice(index, 1);
        }
      });

      this.#logger.log('Check user not exists.');

      if (reverseUserIds.length) {
        await this.repository.updateNotification(
          { _id: notify._id },
          {
            $pull: { sourceUserId: { $in: reverseUserIds } },
          },
        );
        this.#logger.log('Check user empty at notification.');
        const notifyUserEmpty = await this.repository.findNotification({
          _id: notify._id,
        });

        if (notifyUserEmpty && !notifyUserEmpty?.sourceUserId?.length) {
          await notifyUserEmpty.remove();
          return;
        }
      }

      if (!userSort.length) return;
    }

    if (!requestedBy) return;

    const displayNames = userSort.map((user) => user.displayName);

    const message = this.generateMessageByType(
      notify,
      displayNames,
      language,
      requestedBy,
    );

    this.#logger.log('Prepare message show display name.', message);
    return {
      message,
      user: userSort ? userSort[0] : undefined,
      haveUser: userSort.length,
    };
  };

  private prepareNotification = (
    notify: Notification,
    account: Account,
    message: string,
    badgeCounts: number,
    user?: User,
    haveUsers?: number,
  ) => {
    return {
      notification: {
        body: message,
      },
      android: {
        priority: AndroidMessagePriority.HIGH,
        notification: {
          body: message,
          default_sound: true,
          notification_count: badgeCounts,
        },
      },
      aps: {
        alert: message,
        badge: badgeCounts,
        sound: SoundDeviceDefault.Default,
        'mutable-content': 1,
      },
      payload: this.toNotificationPayload(
        notify,
        message,
        this.checkNotificationTypePage(
          notify.type,
          notify.commentRef ? NotificationRef.Comment : NotificationRef.Content,
        ),
        user,
        haveUsers,
      ) as any,
      firebaseTokens: account?.devices.map((item) => item.firebaseToken),
    };
  };

  private toNotificationPayload = (
    notify: Notification,
    message: string,
    landingPage: string,
    user?: User,
    haveUsers?: number,
  ) => {
    return {
      message,
      landingPage,
      id: notify._id,
      source: notify.source,
      type: notify.type,
      user: notify.user?._id,
      actionId: haveUsers === 1 ? user?._id : undefined,
      actionCastcleId: haveUsers === 1 ? user?.displayId : undefined,
      commentId: String(notify.commentRef),
      contentId: String(notify.contentRef),
      replyId: String(notify.replyRef),
      advertiseId: String(notify.adsRef),
      profileId: String(notify.profileRef),
      systemId: String(notify.systemRef),
      createdAt: notify.createdAt.toISOString(),
      updatedAt: notify.updatedAt.toISOString(),
    } as PushNotificationPayload;
  };

  private toNotificationResponse = (
    notify: Notification,
    message: string,
    landingPage: string,
    user?: User,
    haveUsers?: number,
  ) => {
    return {
      id: notify._id,
      source: notify.source,
      read: notify.read,
      type: notify.type,
      message: message,
      landingPage: landingPage,
      user: notify.user?._id,
      actionId: haveUsers === 1 ? user?._id : undefined,
      actionCastcleId: haveUsers === 1 ? user?.displayId : undefined,
      avatar: user?.profile?.images?.avatar
        ? CastcleImage.sign(user.profile.images.avatar)
        : Configs.DefaultAvatarImages,
      commentId: notify.commentRef,
      contentId: notify.contentRef,
      replyId: notify.replyRef,
      advertiseId: notify.adsRef,
      profileId: notify.profileRef,
      systemId: notify.systemRef,
      createdAt: notify.createdAt,
      updatedAt: notify.updatedAt,
    } as NotificationPayloadDto;
  };

  getFromId = async (_id: string) => {
    return this.repository.findNotification({ _id });
  };

  getAllNotify = async (
    account: Account,
    { maxResults, ...query }: NotificationQuery,
  ) => {
    return this.repository.findNotifications(
      {
        ...query,
        ...{ account: account._id },
      },
      {
        sort: { createdAt: -1, updatedAt: -1 },
        limit: maxResults,
      },
    );
  };

  readNotify = async (_id: string) => {
    await this.repository.updateNotification({ _id }, { $set: { read: true } });
  };

  readAllSourceNotify = async (
    account: Account,
    source: NotificationSource,
  ) => {
    await this.repository.updateNotifications(
      { account: account._id, source },
      { $set: { read: true } },
    );
  };

  deleteNotify = async (_id: string) => {
    await this.repository.deleteNotification({ _id });
  };

  deleteAllSourceNotify = async (
    account: Account,
    source: NotificationSource,
  ) => {
    await this.repository.deleteNotifications({
      account: account._id,
      source: source,
    });
  };

  getBadges = async (account: Account) => {
    const [totalNotification] = await this.repository.aggregationNotification(
      pipelineNotificationBadge(account._id),
    );
    if (!totalNotification)
      return {
        profile: 0,
        page: 0,
        system: 0,
      };

    return totalNotification;
  };

  generateNotificationsResponse = async (
    notifications: Notification[],
    language: string,
  ) => {
    this.#logger.log('Start generate notification message list.');

    const payloadNotify = await Promise.all(
      notifications.map(async (notify: Notification) => {
        const userOwner = notify?.user
          ? await this.repository.findUser({
              _id: notify.user._id,
            })
          : null;

        const { message, user, haveUser } = await this.generateMessage(
          notify,
          userOwner,
          language,
        );

        return this.toNotificationResponse(
          notify,
          message,
          this.checkNotificationTypePage(
            notify.type,
            notify.commentRef
              ? NotificationRef.Comment
              : NotificationRef.Content,
          ),
          user,
          haveUser,
        );
      }),
    );

    return payloadNotify.filter((payload) => payload);
  };

  notifyToUser = async (
    { sourceUserId, read, ...notificationData }: CreateNotification,
    requestedBy: User,
    language: string,
  ) => {
    this.#logger.log('Check user action notify.');
    if (String(sourceUserId) === String(requestedBy._id)) return;

    this.#logger.log('Check configuration notify to user.');
    if (!this.checkNotify(notificationData)) return;

    const filters = {
      ...notificationData,
      ...{
        contentRef: notificationData.contentRef ?? { $exists: false },
        commentRef: notificationData.commentRef ?? { $exists: false },
        replyRef: notificationData.replyRef ?? { $exists: false },
        profileRef: notificationData.profileRef ?? { $exists: false },
      },
    };

    this.#logger.log(`Check interval time follow user.`);

    if (notificationData.type === NotificationType.Follow) {
      const haveNotify = await this.repository.findNotification(filters, {
        sort: { createdAt: -1 },
      });

      const intervalFollow = CastcleDate.checkIntervalNotify(
        haveNotify?.createdAt,
        Number(Environment.NOTIFY_FOLLOW_INTERVAL),
      );
      if (!intervalFollow) return;
    }

    if (
      [
        NotificationType.Tag,
        NotificationType.Follow,
        NotificationType.IllegalDone,
        NotificationType.IllegalClosed,
        NotificationType.NotIllegal,
      ].some((type) => type === notificationData.type)
    ) {
      await this.repository.createNotification({
        ...notificationData,
        ...{ user: requestedBy._id },
        read,
        sourceUserId,
      });
    } else {
      const updateNotify = await this.repository.updateNotification(
        filters,
        {
          $set: { read, user: requestedBy._id },
          $setOnInsert: notificationData,
          $addToSet: { sourceUserId },
        },
        {
          upsert: true,
        },
      );

      if (!updateNotify.nModified && !updateNotify.upserted) return;
    }

    this.#logger.log('Insert data into notification is done.');

    const notify = await this.repository.findNotification(filters, {
      sort: { createdAt: -1 },
    });

    this.#logger.log('Get devices by account.');

    const account = await this.repository.findAccount({
      _id: notificationData.account._id,
    });

    if (!account?.devices) return;

    this.#logger.log('Generate notification message.');

    const { message, user, haveUser } = await this.generateMessage(
      notify,
      requestedBy,
      language,
    );
    this.#logger.log('Generate notification message is done.');

    if (!message) return;

    this.#logger.log('Send notification message.', JSON.stringify(message));

    const badgeCounts = await this.repository.findNotificationCount({
      user: requestedBy._id,
      account: requestedBy.ownerAccount,
      read: false,
    });

    await this.notificationQueue.add(
      this.prepareNotification(
        notify,
        account,
        message,
        badgeCounts,
        user,
        haveUser,
      ),
      {
        removeOnComplete: true,
      },
    );

    return notify;
  };
}
