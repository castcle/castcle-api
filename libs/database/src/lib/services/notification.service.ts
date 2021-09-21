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
  NotificationMessage,
  NotificationProducer
} from '@castcle-api/utils/queue';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateNotification,
  DEFAULT_NOTIFICATION_QUERY_OPTIONS,
  NotificationQueryOptions,
  NotificationSource,
  NotificationType,
  RegisterTokenDto
} from '../dtos/notification.dto';
import {
  CredentialDocument,
  CredentialModel
} from '../schemas/credential.schema';
import { UserModel } from '../schemas/user.schema';
import { createPagination } from '../utils/common';
import { NotificationDocument } from './../schemas/notification.schema';
@Injectable()
export class NotificationService {
  constructor(
    @InjectModel('Notification')
    public _notificationModel: Model<NotificationDocument>,
    @InjectModel('User')
    public _userModel: UserModel,
    private readonly notificationProducer: NotificationProducer,
    @InjectModel('Credential')
    public _credentialModel: CredentialModel
  ) {}

  /**
   * get all notifications
   * @param {CredentialDocument} credential
   * @param {NotificationQueryOptions} options contain option for sorting page = skip + 1,
   * @returns {Promise<{items:NotificationDocument[], total:number, pagination: {Pagination}}>}
   */
  getAll = async (
    credential: CredentialDocument,
    options: NotificationQueryOptions = DEFAULT_NOTIFICATION_QUERY_OPTIONS
  ) => {
    const user = await this._userModel
      .findOne({
        ownerAccount: credential.account._id
      })
      .exec();

    const findFilter: {
      sourceUserId: any;
      source: string;
    } = {
      sourceUserId: user ? user._id : null,
      source: options.source
    };
    console.log(findFilter);

    let query = this._notificationModel
      .find(findFilter)
      .skip(options.page - 1)
      .limit(options.limit);
    if (options.sortBy.type === 'desc') {
      query = query.sort(`-${options.sortBy.field}`);
    } else {
      query = query.sort(`${options.sortBy.field}`);
    }
    const totalDocument = await this._notificationModel
      .count(findFilter)
      .exec();
    const result = await query.exec();

    return {
      total: totalDocument,
      items: result,
      pagination: createPagination(options, totalDocument)
    };
  };

  /**
   * get notification from notification's id
   * @param {string} id notification's id
   * @returns {NotificationDocument}
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
   * @param {NotificationDocument} notification notofication document
   * @returns {NotificationDocument}
   */
  flagRead = async (notification: NotificationDocument) => {
    if (notification) {
      notification.read = true;
      return notification.save();
    } else {
      return null;
    }
  };

  /**
   * update read flag all notofication
   * @param {CredentialDocument} credential
   * @returns {UpdateWriteOpResult} update result status
   */
  flagReadAll = async (credential: CredentialDocument) => {
    const user = await this._userModel
      .findOne({
        ownerAccount:
          credential.account && credential.account._id
            ? credential.account._id
            : null
      })
      .exec();

    if (user) {
      const findFilter: {
        sourceUserId: any;
      } = {
        sourceUserId: user._id
      };
      console.log(findFilter);

      return await this._notificationModel
        .updateMany(findFilter, { read: true }, null, (err: any, docs: any) => {
          if (err) {
            console.log(err);
          } else {
            console.log('Updated Docs : ', docs);
          }
        })
        .exec();
    } else {
      return null;
    }
  };

  /**
   * create notofication and push to queue
   * @param {CreateNotification} notificationData notofication document
   * @returns {NotificationDocument}
   */
  notifyToUser = async (notificationData: CreateNotification) => {
    console.log('save notification');
    const newNotification = {
      ...notificationData,
      targetRef: {
        $ref:
          notificationData.type !== NotificationType.System
            ? notificationData.type
            : null
      }
    };

    const createResult = await new this._notificationModel(
      newNotification
    ).save();

    // targetRef: {
    //   $ref: 'content',
    //   $id: sourceContentId
    // },
    console.log('get firebase token');
    const credential = await this._credentialModel
      .findOne({ _id: notificationData.credential._id })
      .exec();

    if (createResult && credential) {
      const message: NotificationMessage = {
        id: createResult._id,
        message: createResult.message,
        source: NotificationSource[createResult.source],
        sourceUserId: createResult.sourceUserId._id,
        type: NotificationType[createResult.type],
        targetRefId: createResult.targetRef,
        firebaseToken: credential.firebaseNotificationToken
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
            firebaseNotificationToken: registerTokenDto.firebaseToken
          }
        )
        .exec();
    } else {
      return null;
    }
  };

  /**
   * get total badges from user
   * @param {CredentialDocument} credential
   * @returns {string} total number notification
   */
  getBadges = async (credential: CredentialDocument) => {
    const user = await this._userModel
      .findOne({
        ownerAccount: credential.account._id
      })
      .exec();

    if (user) {
      const totalNotification = await this._notificationModel.countDocuments({
        sourceUserId: user._id,
        read: false
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
