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

import { CacheModuleOptions } from '@nestjs/common';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { QueueOptions } from 'bull';
import * as redisStore from 'cache-manager-redis-store';
import { Environment } from './environments';

export const getBullModuleOptions = (): QueueOptions => ({
  redis: {
    host: Environment.REDIS_QUEUE_HOST,
    port: Environment.REDIS_QUEUE_PORT,
    password: Environment.REDIS_QUEUE_PASSWORD,
  },
});

export const getCacheModuleOptions = (): CacheModuleOptions => ({
  store: redisStore,
  host: Environment.REDIS_CACHE_HOST,
  port: Environment.REDIS_CACHE_PORT,
  password: Environment.REDIS_CACHE_PASSWORD,
  ttl: 1000,
});

export const getMongooseModuleOptions = (): MongooseModuleOptions => ({
  uri: Environment.DB_URI,
  useCreateIndex: true,
  useFindAndModify: false,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

export const getMongooseBackofficeModuleOptions =
  (): MongooseModuleOptions => ({
    uri: Environment.BACKOFFICE_DB_URI,
    useCreateIndex: true,
    useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

export const getMongooseBackofficeAppModuleOptions =
  (): MongooseModuleOptions => ({
    uri: Environment.BACKOFFICE_APP_DB_URI,
    useCreateIndex: true,
    useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
