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

import { DatabaseModule } from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { AwsXRayInterceptor } from '@castcle-api/utils/interceptors';
import { UtilsQueueModule } from '@castcle-api/utils/queue';
import { TracingModule } from '@narando/nest-xray';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseModule } from 'nestjs-firebase';
import { CampaignConsumer } from './consumers/campaign.consumer';
import { ContentConsumer } from './consumers/content.consumer';
import { NotificationConsumer } from './consumers/notification.consumer';
import { UserConsumer } from './consumers/user.consumer';
import { CampaignScheduler } from './schedulers/campaign.scheduler';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    UtilsQueueModule,
    FirebaseModule.forRoot({
      googleApplicationCredential: {
        projectId: Environment.FIREBASE_PROJECT_ID,
        clientEmail: Environment.FIREBASE_CLIENT_EMAIL,
        privateKey: Environment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    }),
    TracingModule.forRoot({
      serviceName: 'backgrounds',
      daemonAddress: Environment.AWS_XRAY_DAEMON_ADDRESS,
    }),
  ],
  providers: [
    CampaignConsumer,
    CampaignScheduler,
    ContentConsumer,
    NotificationConsumer,
    UserConsumer,
    {
      provide: APP_INTERCEPTOR,
      useClass: AwsXRayInterceptor,
    },
  ],
})
export class BackgroundModule {}
