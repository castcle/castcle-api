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
import { HealthyModule } from '@castcle-api/healthy';
import { UtilsAwsModule } from '@castcle-api/utils/aws';
import { UtilsCacheModule } from '@castcle-api/utils/cache';
import { UtilsClientsModule } from '@castcle-api/utils/clients';
import { UtilsInterceptorsModule } from '@castcle-api/utils/interceptors';
import { Module } from '@nestjs/common';
import { UserController } from './app.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { SuggestionService } from './services/suggestion.service';
import { TracingModule } from '@narando/nest-xray';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AwsXRayInterceptor } from '@castcle-api/utils/interceptors';
import { Environment } from '@castcle-api/environments';
import { CastcleThrottlerGuard } from '@castcle-api/utils/exception';
@Module({
  imports: [
    DatabaseModule,
    HealthyModule,
    UtilsCacheModule,
    UtilsInterceptorsModule,
    UtilsAwsModule,
    UtilsClientsModule,
    TracingModule.forRoot({
      serviceName: 'users',
      daemonAddress: Environment.AWS_XRAY_DAEMON_ADDRESS,
    }),
    ThrottlerModule.forRoot({
      ttl: Environment.RATE_LIMIT_TTL,
      limit: Environment.RATE_LIMIT_LIMIT,
    }),
  ],
  controllers: [UserController],
  providers: [
    SuggestionService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AwsXRayInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: CastcleThrottlerGuard,
    },
  ],
})
export class UserModule {}
