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
import { CastcleCacheModule, Environment } from '@castcle-api/environments';
import { HealthyModule } from '@castcle-api/healthy';
import { CastcleThrottlerModule } from '@castcle-api/throttler';
import { UtilsAwsModule } from '@castcle-api/utils/aws';
import { UtilsClientsModule } from '@castcle-api/utils/clients';
import {
  AwsXRayInterceptor,
  UtilsInterceptorsModule,
} from '@castcle-api/utils/interceptors';
import { TracingModule } from '@narando/nest-xray';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsControllerV2 } from './controllers/notifications.controller.v2';
import { PagesController } from './controllers/pages.controller';
import { UsersController } from './controllers/users.controller';
import { UsersControllerV2 } from './controllers/users.controller.v2';
import { SuggestionService } from './services/suggestion.service';

@Module({
  imports: [
    CastcleCacheModule,
    CastcleThrottlerModule,
    DatabaseModule,
    HealthyModule,
    RouterModule.register([{ path: 'users', module: HealthyModule }]),
    UtilsInterceptorsModule,
    UtilsAwsModule,
    UtilsClientsModule,
    TracingModule.forRoot({
      serviceName: 'users',
      daemonAddress: Environment.AWS_XRAY_DAEMON_ADDRESS,
    }),
  ],
  controllers: [
    NotificationsController,
    NotificationsControllerV2,
    PagesController,
    UsersController,
    UsersControllerV2,
  ],
  providers: [
    SuggestionService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AwsXRayInterceptor,
    },
  ],
})
export class AppModule {}
