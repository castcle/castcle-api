import { NotificationRef } from './../dtos/notification.dto';
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
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  CreateNotification,
  DEFAULT_NOTIFICATION_QUERY_OPTIONS,
  NotificationQueryOptions,
  NotificationType,
  RegisterTokenDto,
} from '../dtos';
import { NotificationMessage, QueueName } from '../models';
import { Content, Credential, Notification, User, UserType } from '../schemas';
import { CastcleLocalization } from '@castcle-api/utils/commons';
import { AccountDevice } from '../schemas/account-device.schema';

@Injectable()
export class NotificationService {
  #logger = new CastLogger(NotificationService.name);

  constructor(
    @InjectModel('Notification')
    private _notificationModel: Model<Notification>,
    @InjectModel('User')
    private _userModel: Model<User>,
    @InjectModel('Credential')
    private _credentialModel: Model<Credential>,
    @InjectModel('Comment') private _commentModel: Model<Comment>,
    @InjectModel('Content') private _contentModel: Model<Content>,
    @InjectModel('AccountDevice')
    private _accountDeviceModel: Model<AccountDevice>,
    @InjectQueue(QueueName.NOTIFICATION)
    private notificationQueue: Queue<NotificationMessage>
  ) {}

  /**
   * get all notifications
   * @param {Credential} credential
   * @param {NotificationQueryOptions} options contain option for sorting page,
   * @returns
   */
  getNotificationAll = async (
    credential: Credential,
    {
      source,
      sinceId,
      untilId,
      maxResults,
    }: NotificationQueryOptions = DEFAULT_NOTIFICATION_QUERY_OPTIONS
  ) => {
    const filter: FilterQuery<Notification> = {
      account: credential.account._id,
    };

    if (source) filter.source = source;
    if (sinceId)
      filter._id = {
        $gt: Types.ObjectId(sinceId),
      };

    if (untilId)
      filter._id = {
        $lt: Types.ObjectId(untilId),
      };

    return this._notificationModel
      .find(filter)
      .limit(+maxResults)
      .sort({ updatedAt: -1 })
      .exec();
  };

  /**
   * get notification from notification's id
   * @param {string} id notification's id
   * @returns
   */
  getFromId = async (id: string) => {
    return this._notificationModel.findById(id ? id : null).exec();
  };

  /**
   * update read flag from notification
   * @param {Notification} notification notification document
   * @returns
   */
  flagRead = async (notification: Notification) => {
    if (!notification) return;
    notification.read = true;
    return await notification.save();
  };

  /**
   * update read flag all notification
   * @param {Credential} credential
   * @returns {UpdateWriteOpResult} update result status
   */
  flagReadAll = async ({ account }: Credential) => {
    return this._notificationModel
      .updateMany({ account: account._id }, { read: true })
      .exec();
  };
  /**
   * create notification and push to queue
   * @param {CreateNotification} notificationData notification document
   * @returns
   */
  notifyToUser = async (
    { sourceUserId, read, ...notificationData }: CreateNotification,
    userOwner: User,
    language: string
  ) => {
    this.#logger.log('Notification to user.');
    const targetRef = {
      $id: notificationData.targetRef._id,
      $ref: notificationData.targetRef.ref
        ? notificationData.targetRef.ref
        : null,
    };

    this.#logger.log('Prepare data into notification.');
    if (notificationData.type === NotificationType.Tag) {
      await new this._notificationModel({
        ...notificationData,
        targetRef,
        read,
        sourceUserId,
      }).save();
    } else {
      const updateNotify = await this._notificationModel.updateOne(
        {
          targetRef,
          account: notificationData.account,
          type: notificationData.type,
        },
        {
          $set: { read },
          $setOnInsert: {
            ...notificationData,
            targetRef,
          },
          $addToSet: { sourceUserId },
        },
        {
          upsert: true,
        }
      );

      if (!updateNotify.nModified && !updateNotify.upserted) return;
    }
    this.#logger.log('Insert data into notification is done.');

    const notify = await this._notificationModel
      .findOne({
        targetRef,
        account: notificationData.account,
        type: notificationData.type,
      })
      .exec();

    this.#logger.log(
      'Insert data into notification is done.',
      JSON.stringify(notify)
    );

    this.#logger.log('Get credentials by account.');

    const firebaseToken = await this._accountDeviceModel
      .find({
        account: Types.ObjectId(notificationData.account._id),
      })
      .exec();

    this.#logger.log('Generate notification message.');

    const message = await this.generateMessage(userOwner, notify, language);
    this.#logger.log('Generate notification message is done.');

    this.#logger.log('Send notification message.', JSON.stringify(message));

    this.notificationQueue.add(
      this.generateNotification(message, notify, firebaseToken)
    );

    return notify;
  };

  /**
   * update firebase token to credential
   * @param {RegisterTokenDto} registerTokenDto register request
   * @returns {UpdateWriteOpResult} update result status
   */
  registerToken = async (registerTokenDto: RegisterTokenDto) => {
    return this._credentialModel
      .updateOne(
        { deviceUUID: registerTokenDto?.deviceUUID },
        {
          firebaseNotificationToken: registerTokenDto?.firebaseToken,
        }
      )
      .exec();
  };

  /**
   * get total badges from user
   * @param {Credential} credential
   * @returns {string} total number notification
   */
  getBadges = async (credential: Credential) => {
    const totalNotification = await this._notificationModel.countDocuments({
      account: credential.account._id,
      read: false,
    });

    this.#logger.log(`Total notification badges : ${totalNotification}`);

    if (!totalNotification) return '';
    if (totalNotification > 99) return '+99';
    if (totalNotification <= 99) return String(totalNotification);
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

    const userSort: User[] = [];

    this.#logger.log('Sort user by latest user action.');

    users.forEach((user) => {
      const index = userIds.indexOf(user._id);
      if (index > -1) userSort[index] = user;
    });
    let message = '';
    const displayNames = users.map((user) => user.displayName);
    if (notify.type === NotificationType.Like)
      message = CastcleLocalization.getTemplateLike(
        language,
        displayNames,
        userOwner.type === UserType.Page ? userOwner.displayName : ''
      );
    if (notify.type === NotificationType.Comment)
      message = CastcleLocalization.getTemplateComment(
        language,
        displayNames,
        userOwner.type === UserType.Page ? userOwner.displayName : ''
      );
    if (notify.type === NotificationType.Farm)
      message = CastcleLocalization.getTemplateFarm(
        language,
        displayNames,
        userOwner.type === UserType.Page ? userOwner.displayName : ''
      );
    if (notify.type === NotificationType.Quote)
      message = CastcleLocalization.getTemplateQuote(
        language,
        displayNames,
        userOwner.type === UserType.Page ? userOwner.displayName : ''
      );
    if (notify.type === NotificationType.Recast)
      message = CastcleLocalization.getTemplateRecast(
        language,
        displayNames,
        userOwner.type === UserType.Page ? userOwner.displayName : ''
      );
    if (notify.type === NotificationType.Reply)
      message = CastcleLocalization.getTemplateReply(
        language,
        displayNames,
        userOwner.type === UserType.Page ? userOwner.displayName : ''
      );

    if (notify.type === NotificationType.Tag)
      message = CastcleLocalization.getTemplateTag(
        language,
        displayNames,
        userOwner.type === UserType.Page ? userOwner.displayName : ''
      );

    if (notify.type === NotificationType.System)
      message = CastcleLocalization.getTemplateSystem(language, displayNames);

    if (notify.type === NotificationType.AdsApprove)
      message = CastcleLocalization.getTemplateAdsApprove(language);

    if (notify.type === NotificationType.AdsDecline)
      message = CastcleLocalization.getTemplateAdsDecline(language);

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
        let targetRef: any;
        if (notify.targetRef?.$ref === NotificationRef.Comment) {
          targetRef = await this._commentModel
            .findOne({ _id: notify.targetRef.oid || notify.targetRef.$id })
            .exec();
        }
        if (notify.targetRef?.$ref === NotificationRef.Content) {
          targetRef = await this._contentModel
            .findOne({ _id: notify.targetRef.oid || notify.targetRef.$id })
            .exec();
        }
        const userIds = notify.sourceUserId?.reverse();
        const users: User[] = await this._userModel
          .find({
            _id: { $in: userIds },
          })
          .exec();
        const userSort: User[] = [];
        users.forEach((user) => {
          const index = userIds.indexOf(user._id);
          if (index > -1) userSort[index] = user;
        });

        let message = '';
        const displayNames = users.map((user) => user.displayName);
        if (notify.type === NotificationType.Like)
          message = CastcleLocalization.getTemplateLike(
            language,
            displayNames,
            targetRef?.author.type === UserType.Page
              ? targetRef?.author.displayName
              : ''
          );
        if (notify.type === NotificationType.Comment)
          message = CastcleLocalization.getTemplateComment(
            language,
            displayNames,
            targetRef?.author.type === UserType.Page
              ? targetRef?.author.displayName
              : ''
          );
        if (notify.type === NotificationType.Farm)
          message = CastcleLocalization.getTemplateFarm(
            language,
            displayNames,
            targetRef?.author.type === UserType.Page
              ? targetRef?.author.displayName
              : ''
          );
        if (notify.type === NotificationType.Quote)
          message = CastcleLocalization.getTemplateQuote(
            language,
            displayNames,
            targetRef?.author.type === UserType.Page
              ? targetRef?.author.displayName
              : ''
          );
        if (notify.type === NotificationType.Recast)
          message = CastcleLocalization.getTemplateRecast(
            language,
            displayNames,
            targetRef?.author.type === UserType.Page
              ? targetRef?.author.displayName
              : ''
          );
        if (notify.type === NotificationType.Reply)
          message = CastcleLocalization.getTemplateReply(
            language,
            displayNames,
            targetRef?.author.type === UserType.Page
              ? targetRef?.author.displayName
              : ''
          );

        if (notify.type === NotificationType.Tag)
          message = CastcleLocalization.getTemplateTag(
            language,
            displayNames,
            targetRef?.author.type === UserType.Page
              ? targetRef?.author.displayName
              : ''
          );

        if (notify.type === NotificationType.System)
          message = CastcleLocalization.getTemplateSystem(
            language,
            displayNames
          );
        if (notify.type === NotificationType.AdsApprove)
          message = CastcleLocalization.getTemplateAdsApprove(language);

        if (notify.type === NotificationType.AdsDecline)
          message = CastcleLocalization.getTemplateAdsDecline(language);

        this.#logger.log('Prepare message show display name.', message);

        return notify.toNotificationPayload({
          message: message,
          user: users[0],
        });
      })
    );
  };

  generateNotification = (
    message: string,
    notify: Notification,
    firebaseToken: AccountDevice[]
  ) => {
    return {
      aps: {
        alert: message,
        badge: 1,
        category:
          notify.type === NotificationType.Comment ? 'COMMENTS' : 'CONTENTS',
        sound: 'default',
        'mutable-content': 1,
      },
      payload: notify.toNotificationPayload({ message }),
      firebaseTokens: firebaseToken.map((item) => String(item.firebaseToken)),
    } as NotificationMessage;
  };
}
