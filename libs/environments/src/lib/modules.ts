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

import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Environment } from './environments';
import {
  getBullModuleOptions,
  getCacheModuleOptions,
  getMongooseBackofficeAppModuleOptions,
  getMongooseBackofficeModuleOptions,
  getMongooseModuleOptions,
} from './factories';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => getBullModuleOptions(),
    }),
  ],
  exports: [BullModule],
})
export class CastcleBullModule {}

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: () => getCacheModuleOptions(),
    }),
  ],
  exports: [CacheModule],
})
export class CastcleCacheModule {}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => getMongooseModuleOptions(),
    }),
  ],
  exports: [MongooseModule],
})
export class CastcleMongooseModule {}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => getMongooseBackofficeModuleOptions(),
      connectionName: Environment.BACKOFFICE_DB_DATABASE_NAME,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => getMongooseBackofficeAppModuleOptions(),
      connectionName: Environment.DB_DATABASE_NAME,
    }),
  ],
  exports: [MongooseModule],
})
export class CastcleBackofficeMongooseModule {}
