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

import { CaslModule } from '@castcle-api/casl';
import { DatabaseModule } from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { HealthyModule } from '@castcle-api/healthy';
import { UtilsCacheModule } from '@castcle-api/utils/cache';
import { CastcleThrottlerGuard } from '@castcle-api/utils/exception';
import {
  AwsXRayInterceptor,
  UtilsInterceptorsModule,
} from '@castcle-api/utils/interceptors';
import { UtilsPipesModule } from '@castcle-api/utils/pipes';
import { TracingModule } from '@narando/nest-xray';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommentController } from './controllers/comment.controller';
import { CommentControllerV2 } from './controllers/comment.controller.v2';
import { ContentController } from './controllers/content.controller';
import { CountryController } from './controllers/country.controller';
import { FeedsController } from './controllers/feeds.controller';
import { HashtagsController } from './controllers/hashtags.controller';
import { LanguagesController } from './controllers/languages.controller';
import { SearchesController } from './controllers/searches.controller';
import { AppService, SuggestionService } from './services';

@Module({
  imports: [
    DatabaseModule,
    CaslModule,
    HealthyModule,
    RouterModule.register([{ path: 'feeds', module: HealthyModule }]),
    UtilsInterceptorsModule,
    UtilsCacheModule,
    UtilsPipesModule,
    ThrottlerModule.forRoot({
      ttl: Environment.RATE_LIMIT_TTL,
      limit: Environment.RATE_LIMIT_LIMIT,
    }),
    TracingModule.forRoot({
      serviceName: 'feeds',
      daemonAddress: Environment.AWS_XRAY_DAEMON_ADDRESS,
    }),
  ],
  controllers: [
    CommentController,
    ContentController,
    CountryController,
    FeedsController,
    HashtagsController,
    LanguagesController,
    SearchesController,
    CommentControllerV2,
  ],
  providers: [
    AppService,
    SuggestionService,
    {
      provide: APP_GUARD,
      useClass: CastcleThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AwsXRayInterceptor,
    },
  ],
})
export class AppModule {}
