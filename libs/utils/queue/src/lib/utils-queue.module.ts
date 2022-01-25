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
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TopicName } from './enum/topic.name';
import { NotificationMessage } from './messages/notification.message';
import { NotificationProducer } from './producers/notification.producer';
import { UserProducer } from './producers/user.producer';
import { UserMessage } from './messages/user.message';
import { ContentProducer } from './producers/content.producer';
import { ContentMessage } from './messages/content.message';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: Environment.REDIS_HOST,
        port: Environment.REDIS_PORT,
      },
    }),
    BullModule.registerQueue({
      name: TopicName.Notifications,
    }),
    BullModule.registerQueue({
      name: TopicName.Users,
    }),
    BullModule.registerQueue({
      name: TopicName.Contents,
    }),
  ],
  controllers: [],
  providers: [NotificationProducer, UserProducer, ContentProducer],
  exports: [BullModule, NotificationProducer, UserProducer, ContentProducer],
})
export class UtilsQueueModule {}

export {
  TopicName,
  NotificationProducer,
  NotificationMessage,
  UserProducer,
  UserMessage,
  ContentProducer,
  ContentMessage,
};
