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

import { CastcleHealthyModule, CastcleTracingModule } from '@castcle-api/core';
import { DatabaseModule } from '@castcle-api/database';
import {
  CastcleBackofficeMongooseModule,
  CastcleBullModule,
  CastcleCacheModule,
} from '@castcle-api/environments';
import { Mailer } from '@castcle-api/utils/clients';
import { Module } from '@nestjs/common';
import { AdsController } from './controllers/ads.controller';
import { AirdropsController } from './controllers/airdrops.controller';
import { AuthenticationController } from './controllers/authentication.controller';
import { CampaignController } from './controllers/campaign.controller';
import { MetaDataController } from './controllers/metadata.controller';
import { ReportingController } from './controllers/reporting.controller';
import { UsersController } from './controllers/users.controller';
import { BackOfficeMongooseForFeatures } from './schemas';
import { AirdropService } from './services/airdrop.service';
import { AuthenticationService } from './services/authentication.service';
import { CampaignBackofficeService } from './services/campaign.service';
import { MetadataBackofficeService } from './services/metadata.service';
import { ReportingService } from './services/reporting.service';
import { UserBackofficeService } from './services/users.service';

@Module({
  imports: [
    BackOfficeMongooseForFeatures,
    CastcleBackofficeMongooseModule,
    CastcleBullModule,
    CastcleCacheModule,
    CastcleHealthyModule.register({ pathPrefix: 'backoffices' }),
    CastcleTracingModule.forRoot({ serviceName: 'backoffices' }),
    DatabaseModule,
  ],
  controllers: [
    AdsController,
    AirdropsController,
    AuthenticationController,
    CampaignController,
    MetaDataController,
    ReportingController,
    UsersController,
  ],
  providers: [
    AirdropService,
    AuthenticationService,
    CampaignBackofficeService,
    Mailer,
    MetadataBackofficeService,
    ReportingService,
    UserBackofficeService,
  ],
})
export class AppModule {}
