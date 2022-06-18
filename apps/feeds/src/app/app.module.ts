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
import { CastcleCacheModule } from '@castcle-api/environments';
import { CastcleHealthyModule } from '@castcle-api/healthy';
import { CastcleThrottlerModule } from '@castcle-api/throttler';
import { CastcleTracingModule } from '@castcle-api/tracing';
import { UtilsInterceptorsModule } from '@castcle-api/utils/interceptors';
import { UtilsPipesModule } from '@castcle-api/utils/pipes';
import { Module } from '@nestjs/common';
import { AdsController } from './controllers/ads.controller';
import { CommentController } from './controllers/comment.controller';
import { CommentControllerV2 } from './controllers/comment.controller.v2';
import { ContentController } from './controllers/content.controller';
import { ContentControllerV2 } from './controllers/content.controller.v2';
import { CountryController } from './controllers/country.controller';
import { FeedsController } from './controllers/feeds.controller';
import { FeedsControllerV2 } from './controllers/feeds.controller.v2';
import { HashtagsController } from './controllers/hashtags.controller';
import { LanguagesController } from './controllers/languages.controller';
import { MetaDataControllerV2 } from './controllers/metadatas.controller.v2';
import { SearchesController } from './controllers/searches.controller';
import { SearchesControllerV2 } from './controllers/searches.controller.v2';
import { AppService, SuggestionService } from './services';

@Module({
  imports: [
    CastcleCacheModule,
    CastcleHealthyModule.register({ pathPrefix: 'feeds' }),
    CastcleThrottlerModule,
    CastcleTracingModule.forRoot({ serviceName: 'feeds' }),
    DatabaseModule,
    UtilsInterceptorsModule,
    UtilsPipesModule,
  ],
  controllers: [
    AdsController,
    CommentController,
    CommentControllerV2,
    ContentController,
    ContentControllerV2,
    CountryController,
    FeedsController,
    FeedsControllerV2,
    HashtagsController,
    LanguagesController,
    MetaDataControllerV2,
    SearchesController,
    SearchesControllerV2,
  ],
  providers: [AppService, SuggestionService],
})
export class AppModule {}
