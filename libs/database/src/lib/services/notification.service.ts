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
import { CastLogger } from '@castcle-api/logger';
import {
  NotificationMessage,
  NotificationProducer,
} from '@castcle-api/utils/queue';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  CreateNotification,
  DEFAULT_NOTIFICATION_QUERY_OPTIONS,
  NotificationQueryOptions,
  NotificationSource,
  NotificationType,
  RegisterTokenDto,
} from '../dtos/notification.dto';
import { Account, Credential, Notification, User } from '../schemas';
import { createCastcleMeta } from '../utils/common';

@Injectable()
export class NotificationService {
  private logger = new CastLogger(NotificationService.name);

  constructor(
    @InjectModel('Notification')
    public _notificationModel: Model<Notification>,
    @InjectModel('User')
    public _userModel: Model<User>,
    private readonly notificationProducer: NotificationProducer,
    @InjectModel('Credential')
    public _credentialModel: Model<Credential>,
    @InjectModel('Account') public _accountModel: Model<Account>
  ) {}

  /**
   * get all notifications
   * @param {Credential} credential
   * @param {NotificationQueryOptions} options contain option for sorting page = skip + 1,
   * @returns {Promise<{items:Notification[], total:number, pagination: {Pagination}}>}
   */
  getAll = async (
    credential: Credential,
    options: NotificationQueryOptions = DEFAULT_NOTIFICATION_QUERY_OPTIONS
  ) => {
    this.logger.log('prepare filter');
    const filter: FilterQuery<Notification> = {
      account: credential.account._id,
    };

    if (options.source) filter.source = options.source;
    if (options.sinceId) {
      const notificationSince = await this._notificationModel
        .findById(options.sinceId)
        .exec();
      filter.createdAt = {
        $gt: new Date(notificationSince.createdAt),
      };
    } else if (options.untilId) {
      const notificationUntil = await this._notificationModel
        .findById(options.untilId)
        .exec();
      filter.createdAt = {
        $lt: new Date(notificationUntil.createdAt),
      };
    }

    this.logger.log('get notification.');
    const documents = await this._notificationModel
      .find(filter)
      .populate('content')
      .limit(+options.maxResults)
      .sort({ createdAt: -1 })
      .exec();

    return {
      items: documents,
      meta: createCastcleMeta(documents),
    };
  };

  /**
   * get notification from notification's id
   * @param {string} id notification's id
   * @returns {Notification}
   */
  getFromId = async (id: string) => {
    const notification = await this._notificationModel
      .findById(id ? id : null)
      .exec();
    if (notification) return notification;
    return null;
  };

  /**
   * update read flag from notofication
   * @param {Notification} notification notofication document
   * @returns {Notification}
   */
  flagRead = async (notification: Notification) => {
    if (notification) {
      notification.read = true;
      const result = notification.save();
      //update account notification Badge
      this._accountModel
        .updateOne(
          { _id: notification.account._id },
          {
            $inc: {
              notificationBadgeCount: -1,
            },
          }
        )
        .exec();
      return result;
    } else {
      return null;
    }
  };

  /**
   * update read flag all notofication
   * @param {Credential} credential
   * @returns {UpdateWriteOpResult} update result status
   */
  flagReadAll = async (credential: Credential) => {
    const user = await this._userModel
      .findOne({
        ownerAccount:
          credential.account && credential.account._id
            ? credential.account._id
            : null,
      })
      .exec();

    if (user) {
      const findFilter: {
        sourceUserId: any;
      } = {
        sourceUserId: user._id,
      };
      console.log(findFilter);

      const result = await this._notificationModel
        .updateMany(findFilter, { read: true }, null, (err: any, docs: any) => {
          if (err) {
            console.log(err);
          } else {
            console.log('Updated Docs : ', docs);
          }
        })
        .exec();
      this._accountModel
        .updateOne(
          { _id: credential.account._id },
          { notificationBadgeCount: 0 }
        )
        .exec();
      return result;
    } else {
      return null;
    }
  };
  /**
   * create notofication and push to queue
   * @param {CreateNotification} notificationData notofication document
   * @returns {Notification}
   */
  notifyToUser = async (notificationData: CreateNotification) => {
    console.log('save notification');
    const newNotification = {
      ...notificationData,
      targetRef: {
        $id: notificationData.targetRef._id,
        $ref:
          notificationData.type !== NotificationType.System
            ? notificationData.type
            : null,
      },
    };

    const createResult = await new this._notificationModel(
      newNotification
    ).save();
    //update account notification Badge
    this._accountModel
      .updateOne(
        { _id: notificationData.account._id },
        {
          $inc: {
            notificationBadgeCount: 1,
          },
        }
      )
      .exec();
    notificationData.account._id;

    const credentials = await this._credentialModel
      .find({
        'account._id': Types.ObjectId(notificationData.account._id),
      })
      .exec();
    if (createResult && notificationData.account) {
      console.log('testSendStuff', notificationData.account);
      console.log(JSON.stringify(credentials));
      const message: NotificationMessage = {
        aps: {
          alert: createResult.message,
          'mutable-content': 1,
          badge: 1,
          category: 'CONTENTS',
          sound: 'default',
        },
        payload: {
          notifyId: createResult._id,
          source: NotificationSource[createResult.source],
          comment:
            NotificationType[createResult.type] === NotificationType.Comment
              ? notificationData.targetRef._id
              : undefined,
          content:
            NotificationType[createResult.type] === NotificationType.Content
              ? notificationData.targetRef._id
              : undefined,
        },
        firebaseTokens: credentials
          .filter((c) => c.firebaseNotificationToken)
          .map((c) => c.firebaseNotificationToken as string),
      };
      console.log('add to queue');
      this.notificationProducer.sendMessage(message);
    }
    return createResult;
  };

  /**
   * update firebase token to credential
   * @param {RegisterTokenDto} registerTokenDto register request
   * @returns {UpdateWriteOpResult} update result status
   */
  registerToken = async (registerTokenDto: RegisterTokenDto) => {
    if (registerTokenDto) {
      console.log('register firebase token');
      return await this._credentialModel
        .updateOne(
          { deviceUUID: registerTokenDto.deviceUUID },
          {
            firebaseNotificationToken: registerTokenDto.firebaseToken,
          }
        )
        .exec();
    } else {
      return null;
    }
  };

  /**
   * get total badges from user
   * @param {Credential} credential
   * @returns {string} total number notification
   */
  getBadges = async (credential: Credential) => {
    const user = await this._userModel
      .findOne({
        ownerAccount: credential.account._id,
      })
      .exec();

    if (user) {
      const totalNotification = await this._notificationModel.countDocuments({
        sourceUserId: user._id,
        read: false,
      });

      console.log(`total badges : ${totalNotification}`);
      if (totalNotification === 0) return '';
      if (totalNotification > 99) return '+99';
      if (totalNotification <= 99) return totalNotification + '';
    } else {
      return '';
    }
  };
}
