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
  CastcleHealthyModule,
  CastcleThrottlerModule,
  CastcleTracingModule,
} from '@castcle-api/core';
import { DatabaseModule } from '@castcle-api/database';
import { CastcleCacheModule } from '@castcle-api/environments';
import { UtilsInterceptorsModule } from '@castcle-api/utils/interceptors';
import { Module } from '@nestjs/common';
import { AdsControllerV2 } from './controllers/ads.controller.v2';
import { CommentControllerV2 } from './controllers/comment.controller.v2';
import { ContentControllerV2 } from './controllers/content.controller.v2';
import { FarmingsControllerV2 } from './controllers/farmings.controller.v2';
import { MetaDataControllerV2 } from './controllers/metadatas.controller.v2';
import { SearchesControllerV2 } from './controllers/searches.controller.v2';
import { FeedsControllerV2 } from './feed/app.controller.v2';
import { RecentFeedService } from './feed/services/recent-feed/service.abstract';
import { RecentFeedServiceImpl } from './feed/services/recent-feed/service.implementation';

@Module({
  imports: [
    CastcleCacheModule,
    CastcleHealthyModule.register({ pathPrefix: 'feeds' }),
    CastcleThrottlerModule,
    CastcleTracingModule.forRoot({ serviceName: 'feeds' }),
    DatabaseModule,
    UtilsInterceptorsModule,
  ],
  controllers: [
    AdsControllerV2,
    CommentControllerV2,
    ContentControllerV2,
    FarmingsControllerV2,
    FeedsControllerV2,
    MetaDataControllerV2,
    SearchesControllerV2,
  ],
  providers: [
    {
      provide: RecentFeedService,
      useClass: RecentFeedServiceImpl,
    },
  ],
})
export class AppModule {}
