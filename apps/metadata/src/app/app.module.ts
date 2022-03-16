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
import { HealthyModule } from '@castcle-api/healthy';
import { UtilsAwsModule } from '@castcle-api/utils/aws';
import { UtilsCacheModule } from '@castcle-api/utils/cache';
import { UtilsClientsModule } from '@castcle-api/utils/clients';
import {
  AwsXRayInterceptor,
  UtilsInterceptorsModule,
} from '@castcle-api/utils/interceptors';
import { TracingModule } from '@narando/nest-xray';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CountryController } from './controllers/country.controller';
import { HashtagsController } from './controllers/hashtags.controller';
import { LanguagesController } from './controllers/languages.controller';

@Module({
  imports: [
    DatabaseModule,
    HealthyModule,
    UtilsCacheModule,
    UtilsInterceptorsModule,
    UtilsAwsModule,
    UtilsClientsModule,
    TracingModule.forRoot({
      serviceName: 'metadata',
      daemonAddress: Environment.AWS_XRAY_DAEMON_ADDRESS,
    }),
  ],
  controllers: [LanguagesController, HashtagsController, CountryController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AwsXRayInterceptor,
    },
  ],
})
export class MetadataModule {}
