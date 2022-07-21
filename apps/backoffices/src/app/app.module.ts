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
  BackofficeDatabaseModule,
  CampaignService,
  NotificationServiceV2,
  QueueName,
} from '@castcle-api/database';
import { CastcleBullModule } from '@castcle-api/environments';
import { CastcleHealthyModule } from '@castcle-api/healthy';
import { CastcleTracingModule } from '@castcle-api/tracing';
import { Mailer } from '@castcle-api/utils/clients';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { AirdropsController } from './controllers/airdrops.controller';
import { AuthenticationController } from './controllers/authentication.controller';
import { CampaignController } from './controllers/campaign.controller';
import { ReportingController } from './controllers/reporting.controller';
import { BackOfficeMongooseForFeatures } from './schemas';
import { AirdropsService } from './services/airdrops.service';
import { AuthenticationService } from './services/authentication.service';
import { CampaignBackofficeService } from './services/campaign.service';
import { ReportingService } from './services/reporting.service';
@Module({
  imports: [
    BackofficeDatabaseModule,
    BackOfficeMongooseForFeatures,
    BullModule.registerQueue(
      { name: QueueName.CAMPAIGN },
      { name: QueueName.NOTIFICATION },
    ),
    CastcleBullModule,
    CastcleHealthyModule.register({ pathPrefix: 'backoffices' }),
    CastcleTracingModule.forRoot({ serviceName: 'backoffices' }),
  ],
  controllers: [
    AirdropsController,
    AuthenticationController,
    CampaignController,
    ReportingController,
  ],
  providers: [
    AirdropsService,
    AuthenticationService,
    CampaignBackofficeService,
    CampaignService,
    ReportingService,
    NotificationServiceV2,
    Mailer,
  ],
})
export class AppModule {}
