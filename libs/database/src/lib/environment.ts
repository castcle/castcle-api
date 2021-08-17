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

export const env = {
  db_test_in_db:
    Environment && Environment.db_test_in_db
      ? Environment.db_test_in_db
      : false,
  db_uri:
    Environment && Environment.db_password
      ? Environment.db_uri
      : 'mongodb://localhost:27017/test',
  db_options:
    Environment && Environment.db_options ? Environment.db_options : {},
  jwt_refresh_expires_in:
    Environment && Environment.jwt_refresh_expires_in
      ? Environment.jwt_refresh_expires_in
      : '18000',
  jwt_access_expires_in:
    Environment && Environment.jwt_access_expires_in
      ? Environment.jwt_access_expires_in
      : '6001',
  jwt_verify_expires_in:
    Environment && Environment.jwt_verify_expires_in
      ? Environment.jwt_verify_expires_in
      : '6002',
  jwt_access_secret:
    Environment && Environment.jwt_access_secret
      ? Environment.jwt_access_secret
      : 'secretna',
  jwt_refresh_secret:
    Environment && Environment.jwt_refresh_secret
      ? Environment.jwt_refresh_secret
      : 'secretjing',
  jwt_verify_secret:
    Environment && Environment.jwt_verify_secret
      ? Environment.jwt_verify_secret
      : 'secretlen'
};
