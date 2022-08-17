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
  NotificationMessageV2,
  NotificationServiceV2,
  NotificationType,
  QueueName,
  Repository,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { CastcleDate } from '@castcle-api/utils/commons';
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { Types } from 'mongoose';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';

@Injectable()
@Processor(QueueName.NOTIFICATION)
export class NotificationConsumer {
  private logger = new CastLogger(NotificationConsumer.name);

  constructor(
    @InjectFirebaseAdmin() private firebase: FirebaseAdmin,
    private notificationService: NotificationServiceV2,
    private repository: Repository,
  ) {}

  @Process()
  async readOperationJob({ data }: Job<NotificationMessageV2>) {
    const { createNotification, requestedBy, language } = data;

    this.logger.log(JSON.stringify(data));
    this.logger.log('Check user action notify.');
    if (String(createNotification.sourceUserId) === String(requestedBy._id))
      return;

    this.logger.log('Check configuration notify to user.');
    if (!this.notificationService.checkNotify(createNotification)) return;

    const filters = {
      contentRef: createNotification.contentRef ?? { $exists: false },
      commentRef: createNotification.commentRef ?? { $exists: false },
      replyRef: createNotification.replyRef ?? { $exists: false },
      profileRef: createNotification.profileRef ?? { $exists: false },
      advertiseId: createNotification.advertiseId ?? { $exists: false },
      source: createNotification.source,
      account: createNotification.account,
      type: createNotification.type,
    };

    this.logger.log(`Check interval time follow user.`);

    if (createNotification.type === NotificationType.Follow) {
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
      ].some((type) => type === createNotification.type)
    ) {
      await this.repository.createNotification({
        ...createNotification,
        ...{ user: requestedBy._id },
      });
    } else {
      const { sourceUserId, read, ...updateNotifyBody } = createNotification;
      const updateNotify = await this.repository.updateNotification(
        filters,
        {
          $set: { read, user: requestedBy._id },
          $setOnInsert: updateNotifyBody,
          $addToSet: { sourceUserId },
        },
        { upsert: true },
      );

      if (!updateNotify.modifiedCount && !updateNotify.upsertedCount) return;
    }

    this.logger.log('Insert data into notification is done.');

    const notify = await this.repository.findNotification(filters, {
      sort: { createdAt: -1 },
    });

    this.logger.log('Get devices by account.');

    const account = await this.repository.findAccount({
      _id: new Types.ObjectId(createNotification.account as any),
    });

    if (!account?.devices) return;

    this.logger.log('Generate notification message.');

    const { message, user, haveUser } =
      await this.notificationService.generateMessage(
        notify,
        requestedBy,
        language,
      );

    this.logger.log('Generate notification message is done.');

    if (!message) return;

    this.logger.log('Send notification message.', JSON.stringify(message));

    const badgeCounts = await this.repository.findNotificationCount({
      user: requestedBy._id,
      account: requestedBy.ownerAccount,
      read: false,
    });

    const prepareNotification = this.notificationService.prepareNotification(
      notify,
      account,
      message,
      badgeCounts,
      user,
      haveUser,
    );

    await this.firebase.messaging
      .sendMulticast({
        data: JSON.parse(JSON.stringify(prepareNotification.payload)),
        notification: prepareNotification.notification,
        android: prepareNotification.android,
        tokens: prepareNotification.firebaseTokens,
        apns: {
          payload: { aps: prepareNotification.aps },
        },
      })
      .catch((error) => this.logger.error(error));
  }
}
