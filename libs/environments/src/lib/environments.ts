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
const DB_OPTIONS: MongooseModuleOptions =
  process.env.DB_HOST === 'localhost' &&
  process.env.DB_USERNAME === '' &&
  process.env.DB_PASSWORD === ''
    ? {}
    : {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      };

export const Environment = {
  PRODUCTION: process.env.NODE_ENV === 'production',
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  // Database
  DB_USERNAME: process.env.DB_USERNAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_DATABASE_NAME,
  DB_URI: `mongodb+srv://${db_user_pass}${process.env.DB_HOST}/${process.env.DB_DATABASE_NAME}${db_query}`,
  DB_OPTIONS,
  DB_TEST_IN_DB: process.env.DB_TEST_IN_DB === 'yes',
  // Mail Service
  SMTP_ADMIN_EMAIL: process.env.SMTP_ADMIN_EMAIL,
  SMTP_USERNAME: process.env.SMTP_USERNAME,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT) || 465,
  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN as unknown as number,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env
    .JWT_REFRESH_EXPIRES_IN as unknown as number,
  JWT_VERIFY_SECRET: process.env.JWT_VERIFY_SECRET,
  JWT_VERIFY_EXPIRES_IN: process.env.JWT_VERIFY_EXPIRES_IN as unknown as number,
  JWT_SIGNATURE_SECRET: process.env.JWT_SIGNATURE_SECRET,
  JWT_SIGNATURE_EXPIRES_IN: process.env
    .JWT_SIGNATURE_EXPIRES_IN as unknown as number,
  // Cloudfront
  CLOUDFRONT_ACCESS_KEY_ID: process.env.CLOUDFRONT_ACCESS_KEY_ID,
  CLOUDFRONT_PRIVATE_KEY: process.env.CLOUDFRONT_PRIVATE_KEY,
  // Redis
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT as unknown as number,
  // Assets
  ASSETS_BUCKET_NAME: process.env.ASSETS_BUCKET_NAME,
  ASSETS_HOST: process.env.ASSETS_HOST ?? 'https://assets-dev.castcle.com',
  // Twitter Config
  TWITTER_KEY: process.env.TWITTER_KEY,
  TWITTER_SECRET_KEY: process.env.TWITTER_SECRET_KEY,
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN,
  TWITTER_HOST: process.env.TWITTER_HOST,
  // Otp
  OTP_DIGITS: process.env.OTP_DIGITS as unknown as number, // display otp digit default is 8
  OPT_EXPIRES_IN: process.env.OTP_EXPIRES_IN as unknown as number, //second for otp to expire
  // Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  // HTTP
  HTTP_TIME_OUT: process.env.HTTP_TIME_OUT as unknown as number,
  // Facebook
  FACEBOOK_HOST: process.env.FB_HOST,
  FACEBOOK_CLIENT_ID: process.env.FB_CLIENT_ID,
  FACEBOOK_CLIENT_SECRET: process.env.FB_CLIENT_SECRET,
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TG_BOT_TOKEN,
  // Apple
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  APPLE_KEY_IDENTIFIER: process.env.APPLE_KEY_IDENTIFIER,
  APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_OTP_SID: process.env.TWILIO_OTP_SID,
  // Youtube
  YOUTUBE_VERIFY_TOKEN: process.env.YOUTUBE_VERIFY_TOKEN,
  YOUTUBE_WEBHOOK_CALLBACK: process.env.YOUTUBE_WEBHOOK_CALLBACK,
  // ip-api
  IP_API_URL: process.env.IP_API_URL || 'https://ip-api.com/json',
  IP_API_KEY: process.env.IP_API_KEY || null,
  // Google
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_SECRET: process.env.GOOGLE_SECRE,
  // Feed Setting
  AUTO_CREATE_GUEST_FEED:
    process.env.AUTO_CREATE_GUEST_FEED === '1' ? true : false,
};
