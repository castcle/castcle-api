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
  AdsCampaignSchema,
  ContentSchema,
  DatabaseModule,
  ReportingSchema,
  UserSchema,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastcleHealthyModule } from '@castcle-api/healthy';
import { CastcleTracingModule } from '@castcle-api/tracing';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdsController } from './controllers/ads.controller';
import { AuthenticationController } from './controllers/authentication.controller';
import { CampaignTypeController } from './controllers/campaign-type.controller';
import { ReportController } from './controllers/report.controller';
import { AccountSchema } from './schemas/account.schema';
import { CampaignTypeSchema } from './schemas/campaign-type.schema';
import { SessionSchema } from './schemas/session.schema';
import { AdsCampaignService } from './services/ads-campaign.service';
import { AuthenticationService } from './services/authentication.service';
import { CampaignTypeService } from './services/campaign-type.service';
import { ReportService } from './services/report.service';

export const MongooseForFeaturesBO = MongooseModule.forFeature(
  [
    { name: 'Staff', schema: AccountSchema },
    { name: 'StaffSession', schema: SessionSchema },
    { name: 'CampaignType', schema: CampaignTypeSchema },
  ],
  Environment.DB_DATABASE_NAME_BACKOFFICE,
);

export const MongooseForFeaturesApp = MongooseModule.forFeature(
  [
    { name: 'AdsCampaign', schema: AdsCampaignSchema },
    { name: 'Content', schema: ContentSchema },
    { name: 'User', schema: UserSchema },
    { name: 'Reporting', schema: ReportingSchema },
  ],
  Environment.DB_DATABASE_NAME,
);

@Module({
  imports: [
    CastcleHealthyModule.register({ pathPrefix: '' }),
    CastcleTracingModule.forRoot({ serviceName: 'backoffice' }),
    DatabaseModule,
    MongooseForFeaturesApp,
    MongooseForFeaturesBO,
    MongooseModule.forRoot(Environment.DB_URI_BACKOFFICE, {
      connectionName: Environment.DB_DATABASE_NAME_BACKOFFICE,
    }),
    MongooseModule.forRoot(Environment.DB_URI, {
      connectionName: Environment.DB_DATABASE_NAME,
    }),
  ],
  controllers: [
    AdsController,
    AuthenticationController,
    CampaignTypeController,
    ReportController,
  ],
  providers: [
    AdsCampaignService,
    AuthenticationService,
    CampaignTypeService,
    ReportService,
  ],
})
export class AppModule {}
