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

import { MongooseModuleOptions } from '@nestjs/mongoose';
import * as dotenv from 'dotenv';

const env = dotenv.config();
if (!env) {
  throw new Error('Env not found!');
}

// Database
const db_user_pass =
  process.env.DB_USERNAME === '' && process.env.DB_PASSWORD === ''
    ? ''
    : `${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@`;
const db_query =
  process.env.DB_HOST === 'localhost' ? '' : '?retryWrites=true&w=majority';
const db_options: MongooseModuleOptions =
  process.env.DB_HOST === 'localhost' &&
  process.env.DB_USERNAME === '' &&
  process.env.DB_PASSWORD === ''
    ? {}
    : {
        useNewUrlParser: true,
        useUnifiedTopology: true
      };

export const Environment = {
  production: process.env.NODE_ENV === 'production',
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  // Database
  db_username: process.env.DB_USERNAME,
  db_password: process.env.DB_PASSWORD,
  db_host: process.env.DB_HOST,
  db_database_name: process.env.DB_DATABASE_NAME,
  db_uri: `mongodb+srv://${db_user_pass}${process.env.DB_HOST}/${process.env.DB_DATABASE_NAME}${db_query}`,
  db_options,
  db_test_in_db: process.env.DB_TEST_IN_DB === 'yes',
  // Mail Service
  smtp_username: process.env.SMTP_USERNAME,
  smtp_password: process.env.SMTP_PASSWORD,
  smtp_host: process.env.SMTP_HOST,
  smtp_port: process.env.SMTP_PORT as unknown as number,
  // JWT
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN as unknown as number,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  jwt_refresh_expires_in: process.env
    .JWT_REFRESH_EXPIRES_IN as unknown as number,
  jwt_verify_secret: process.env.JWT_VERIFY_SECRET,
  jwt_verify_expires_in: process.env.JWT_VERIFY_EXPIRES_IN as unknown as number,
  jwt_signature_secret: process.env.JWT_SIGNATURE_SECRET,
  jwt_signature_expires_in: process.env
    .JWT_SIGNATURE_EXPIRES_IN as unknown as number,
  // Cloudfront
  cloudfront_access_key_id: process.env.CLOUDFRONT_ACCESS_KEY_ID,
  cloudfront_private_key: process.env.CLOUDFRONT_PRIVATE_KEY,
  // Redis
  redis_host: process.env.REDIS_HOST,
  redis_port: process.env.REDIS_PORT as unknown as number,
  // Assets
  assets_bucket_name: process.env.ASSETS_BUCKET_NAME,
  assets_host: process.env.ASSETS_HOST,
  // Social network
  twitter_key: process.env.TWITTER_KEY,
  twitter_secret_key: process.env.TWITTER_SECRET_KEY,
  twitter_bearer_token: process.env.TWITTER_BEARER_TOKEN,
  // Otp
  otp_digits: process.env.OTP_DIGITS as unknown as number, // display otp digit default is 8
  otp_expires_in: process.env.OTP_EXPIRES_IN as unknown as number, //second for otp to expire
  firebase_project_id: process.env.FIREBASE_PROJECT_ID,
  firebase_client_email: process.env.FIREBASE_CLIENT_EMAIL,
  firebase_private_key: process.env.FIREBASE_PRIVATE_KEY,
  http_time_out: process.env.HTTP_TIME_OUT as unknown as number,
  fb_host: process.env.FB_HOST,
  fb_client_id: process.env.FB_CLIENT_ID,
  fb_client_secret: process.env.FB_CLIENT_SECRET,

  // Twilio
  twilio_account_sid: process.env.TWILIO_ACCOUNT_SID,
  twilio_auth_token: process.env.TWILIO_AUTH_TOKEN,
  twilio_otp_sid: process.env.TWILIO_OTP_SID
};
