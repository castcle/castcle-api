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

import { Environment } from '@castcle-api/environments';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getMongoOptions = (): MongooseModuleOptions => ({
  ...env.DB_OPTIONS,
  uri: env.DB_URI,
});

export const env = {
  DB_TEST_IN_DB: Environment?.DB_TEST_IN_DB || false,
  DB_URI: Environment?.DB_PASSWORD
    ? Environment.DB_URI
    : 'mongodb://localhost:27017/test',
  DB_OPTIONS: Environment?.DB_OPTIONS || {},
  JWT_REFRESH_EXPIRES_IN: Environment?.JWT_REFRESH_EXPIRES_IN || '18000',
  JWT_ACCESS_EXPIRES_IN: Environment?.JWT_ACCESS_EXPIRES_IN || '6001',
  JWT_VERIFY_EXPIRES_IN: Environment?.JWT_VERIFY_EXPIRES_IN || '6002',
  JWT_ACCESS_SECRET: Environment?.JWT_ACCESS_SECRET || 'secretna',
  JWT_REFRESH_SECRET: Environment?.JWT_REFRESH_SECRET || 'secretjing',
  JWT_VERIFY_SECRET: Environment?.JWT_VERIFY_SECRET || 'secretlen',
  OTP_DIGITS: Environment?.OTP_DIGITS || 8,
  OPT_EXPIRES_IN: Environment?.OPT_EXPIRES_IN || 60,
};
