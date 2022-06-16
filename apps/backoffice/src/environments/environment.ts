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

export const environment = {
  ASSETS_HOST: Environment.ASSETS_HOST ?? 'https://assets-dev.castcle.com',
  CLOUDFRONT_ACCESS_KEY_ID: Environment?.CLOUDFRONT_ACCESS_KEY_ID,
  CLOUDFRONT_PRIVATE_KEY: Environment?.CLOUDFRONT_PRIVATE_KEY,
  DB_URI_BACKOFFICE: Environment?.DB_URI_BACKOFFICE,
  DB_URI: Environment?.DB_URI,
  DB_DATABASE_NAME_BACKOFFICE: Environment?.DB_DATABASE_NAME_BACKOFFICE,
  DB_DATABASE_NAME: Environment?.DB_DATABASE_NAME,
  JWT_ACCESS_EXPIRES_IN: Environment?.JWT_ACCESS_EXPIRES_IN || '6001',
  JWT_ACCESS_SECRET: Environment?.JWT_ACCESS_SECRET || 'secretna',
  JWT_REFRESH_EXPIRES_IN: Environment?.JWT_REFRESH_EXPIRES_IN || '18000',
  JWT_REFRESH_SECRET: Environment?.JWT_REFRESH_SECRET || 'secretjing',
  JWT_VERIFY_EXPIRES_IN: Environment?.JWT_VERIFY_EXPIRES_IN || '6002',
  JWT_VERIFY_SECRET: Environment?.JWT_VERIFY_SECRET || 'secretlen',
};
