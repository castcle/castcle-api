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

import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CastcleDate } from '@castcle-api/utils/commons';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, FilterQuery, Types } from 'mongoose';
import { User, Notification, Credential, Account } from '../schemas';
import { createCastcleFilter } from '../utils/common';
import { QueueName, NotificationMessage, UserType } from '../models';
import {
  CreateNotification,
  NotificationType,
  NotificationSource,
  AndroidMessagePriority,
  NotificationQuery,
} from '../dtos';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationServiceV2 {
  #logger = new CastLogger(NotificationServiceV2.name);

  constructor(
    @InjectModel('User')
    private _userModel: Model<User>,
    @InjectModel('Notification')
    private _notificationModel: Model<Notification>,
    @InjectModel('Account')
    private _accountModel: Model<Account>,
    @InjectQueue(QueueName.NOTIFICATION)
    private notificationQueue: Queue<NotificationMessage>,
    private notificationService: NotificationService
  ) {}

  getFromId = async (id: string) => {
    return this._notificationModel.findById(Types.ObjectId(id)).exec();
  };

  getAllNotify = async (credential: Credential, query: NotificationQuery) => {
    const filters: FilterQuery<Notification> = createCastcleFilter(
      { account: credential.account._id },
      query
    );
    if (query?.source) filters.source = query?.source;
    return this._notificationModel
      .find(filters)
      .limit(query.maxResults)
      .sort({ createdAt: -1, updatedAt: -1 })
      .exec();
  };

  readNotify = async (notification: Notification) => {
    notification.read = true;
    return notification.save();
  };

  readAllNotify = async ({ account }: Credential) => {
    return this._notificationModel
      .updateMany({ account: account._id }, { read: true })
      .exec();
  };

  deleteNotify = async (notification: Notification) => {
    return notification.remove();
  };

  getBadges = async (credential: Credential) => {
    const totalNotification = await this._notificationModel.countDocuments({
      account: credential.account._id,
      read: false,
    });
    return totalNotification
      ? totalNotification > 99
        ? '+99'
        : String(totalNotification)
      : '';
  };

  notifyToUser = async (
    { sourceUserId, read, ...notificationData }: CreateNotification,
    userOwner: User,
    language: string
  ) => {
    this.#logger.log('Check configuration notify to user.');

    if (!this.notificationService.checkNotify(notificationData)) return;

    this.#logger.log('Notification to user.');

    this.#logger.log('Prepare data into notification.');

    if (
      notificationData.type === NotificationType.Tag ||
      notificationData.type === NotificationType.Follow
    ) {
      const notifyModel = await this._notificationModel
        .findOne({
          ...notificationData,
          ...{ sourceUserId: { $in: [sourceUserId] } },
        })
        .sort({ _id: -1, createdAt: -1 })
        .exec();

      this.#logger.log(`Check follow interval time.`);
      if (
        !CastcleDate.checkIntervalFollowed(
          notifyModel?.createdAt,
          Number(Environment.NOTIFY_FOLLOW_INTERVAL)
        )
      )
        return;

      await new this._notificationModel({
        ...notificationData,
        read,
        sourceUserId,
      }).save();
    } else {
      const updateNotify = await this._notificationModel.updateOne(
        notificationData,
        {
          $set: { read },
          $setOnInsert: notificationData,
          $addToSet: { sourceUserId },
        },
        {
          upsert: true,
        }
      );

      if (!updateNotify.nModified && !updateNotify.upserted) return;
    }
    this.#logger.log('Insert data into notification is done.');

    if (
      notificationData.type === NotificationType.Tag ||
      notificationData.type === NotificationType.Follow
    )
      notificationData = {
        ...notificationData,
        ...{ sourceUserId: { $in: [sourceUserId] } },
      };

    const notify = await this._notificationModel
      .findOne(notificationData)
      .sort({ createdAt: -1 })
      .exec();
    this.#logger.log(
      'Insert data into notification is done.',
      JSON.stringify(notify)
    );

    this.#logger.log('Get devices by account.');

    const account = await this._accountModel
      .findOne({
        _id: Types.ObjectId(notificationData.account._id),
      })
      .exec();

    if (!account.devices) return;

    this.#logger.log('Generate notification message.');

    const message = await this.generateMessage(userOwner, notify, language);
    this.#logger.log('Generate notification message is done.');

    this.#logger.log('Send notification message.', JSON.stringify(message));

    const badgeCounts = await this._notificationModel
      .countDocuments({
        account: userOwner.ownerAccount,
        read: false,
      })
      .exec();

    this.notificationQueue.add(
      this.generateNotification(message, notify, account, badgeCounts),
      {
        removeOnComplete: true,
      }
    );

    return notify;
  };

  generateMessage = async (
    userOwner: User,
    notify: Notification,
    language: string
  ) => {
    this.#logger.log('Reverse latest user.');

    const userIds = notify.sourceUserId?.reverse();

    this.#logger.log('Get user data.');

    const users = await this._userModel
      .find({
        _id: { $in: userIds },
      })
      .exec();

    if (!notify) return;

    const userSort = [];

    this.#logger.log('Sort user by latest user action.');

    users.forEach((user) => {
      const index = userIds.indexOf(user._id);
      if (index > -1) userSort[index] = user;
    });
    const displayNames = userSort.map((user) => user.displayName);

    const message = this.notificationService.checkTypeGenerateMessage(
      notify,
      displayNames,
      userOwner,
      language
    );

    this.#logger.log('Prepare message show display name.', message);
    return message;
  };

  generateMessagesToNotifications = async (
    notifies: Notification[],
    language: string
  ) => {
    this.#logger.log('Start generate notification message list.');

    return await Promise.all(
      notifies.map(async (notify: Notification) => {
        const usersOwners = await this._userModel
          .find({
            ownerAccount: notify.account,
          })
          .exec();

        const userSource = usersOwners.filter(
          (item) =>
            item.type === UserType.PAGE ||
            (item.type === 'people' &&
              notify.source === NotificationSource.Profile)
        );

        const userIds = notify.sourceUserId?.reverse();
        const users = await this._userModel
          .find({
            _id: { $in: userIds },
          })
          .exec();
        const userSort = [];
        users.forEach((user) => {
          const index = userIds.indexOf(user._id);
          if (index > -1) userSort[index] = user;
        });

        const displayNames = userSort.map((user) => user.displayName);

        const message = this.notificationService.checkTypeGenerateMessage(
          notify,
          displayNames,
          userSource[0],
          language
        );

        this.#logger.log('Prepare message show display name.', message);

        return notify.toNotificationPayload({
          message: message,
          user: userSort[0],
          isDate: true,
          read: notify.read,
        });
      })
    );
  };

  generateNotification = (
    message: string,
    notify: Notification,
    account: Account,
    badgeCounts: number
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
        sound: 'default',
        'mutable-content': 1,
      },
      payload: notify.toNotificationPayload({ message }),
      firebaseTokens: account.devices.map((item) => item.firebaseToken),
    } as NotificationMessage;
  };
}
