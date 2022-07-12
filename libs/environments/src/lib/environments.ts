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

import { Configs } from './configs';

export class Environment {
  static IS_PRODUCTION = process.env.NODE_ENV === 'production';
  static NODE_ENV = process.env.NODE_ENV;
  static PORT = process.env.PORT;

  // Database
  private static DB_USERNAME = process.env.DB_USERNAME;
  private static DB_PASSWORD = process.env.DB_PASSWORD;
  private static DB_AUTHENTICATION =
    Environment.DB_USERNAME && Environment.DB_PASSWORD
      ? `${Environment.DB_USERNAME}:${Environment.DB_PASSWORD}@`
      : '';
  private static DB_HOST = process.env.DB_HOST || 'localhost';
  private static DB_USE_LOCAL = Environment.DB_HOST === 'localhost';
  private static DB_FORMAT = `mongodb${Environment.DB_USE_LOCAL ? '' : '+srv'}`;
  static DB_DATABASE_NAME = process.env.DB_DATABASE_NAME || '';

  static DB_URI = `${Environment.DB_FORMAT}://${Environment.DB_AUTHENTICATION}${Environment.DB_HOST}/${Environment.DB_DATABASE_NAME}?retryWrites=true&w=majority`;

  // Mail Service
  static SMTP_ADMIN_EMAIL = process.env.SMTP_ADMIN_EMAIL || 'admin@castcle.com';
  static SMTP_USERNAME = process.env.SMTP_USERNAME;
  static SMTP_PASSWORD = process.env.SMTP_PASSWORD;
  static SMTP_HOST = process.env.SMTP_HOST;
  static SMTP_PORT = Number(process.env.SMTP_PORT) || 465;

  // JWT
  static JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret';
  static JWT_ACCESS_EXPIRES_IN =
    Number(process.env.JWT_ACCESS_EXPIRES_IN) || 6001;
  static JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'refresh-secret';
  static JWT_REFRESH_EXPIRES_IN =
    Number(process.env.JWT_REFRESH_EXPIRES_IN) || 18000;
  static JWT_VERIFY_SECRET = process.env.JWT_VERIFY_SECRET || 'verify-secret';
  static JWT_VERIFY_EXPIRES_IN =
    Number(process.env.JWT_VERIFY_EXPIRES_IN) || 6002;
  static JWT_SIGNATURE_SECRET = process.env.JWT_SIGNATURE_SECRET;
  static JWT_SIGNATURE_EXPIRES_IN = Number(
    process.env.JWT_SIGNATURE_EXPIRES_IN,
  );

  // Cloudfront
  static CLOUDFRONT_ACCESS_KEY_ID = process.env.CLOUDFRONT_ACCESS_KEY_ID || '';
  static CLOUDFRONT_PRIVATE_KEY = process.env.CLOUDFRONT_PRIVATE_KEY || '';

  // Redis
  static REDIS_CACHE_HOST = process.env.REDIS_CACHE_HOST;
  static REDIS_CACHE_PORT = Number(process.env.REDIS_CACHE_PORT);
  static REDIS_CACHE_PASSWORD = process.env.REDIS_CACHE_PASSWORD;
  static REDIS_QUEUE_HOST = process.env.REDIS_QUEUE_HOST;
  static REDIS_QUEUE_PORT = Number(process.env.REDIS_QUEUE_PORT);
  static REDIS_QUEUE_PASSWORD = process.env.REDIS_QUEUE_PASSWORD;

  // Assets
  static ASSETS_BUCKET_NAME = process.env.ASSETS_BUCKET_NAME;
  static ASSETS_HOST =
    process.env.ASSETS_HOST || 'https://assets-dev.castcle.com';

  // Twitter Config
  static TWITTER_KEY = process.env.TWITTER_KEY;
  static TWITTER_SECRET_KEY = process.env.TWITTER_SECRET_KEY;
  static TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
  static TWITTER_HOST = process.env.TWITTER_HOST;

  // Otp
  /**
   * Display otp digits
   * @default 8
   */
  static OTP_DIGITS = Number(process.env.OTP_DIGITS) || 8;
  /** @default 10 minutes */
  static OTP_EMAIL_EXPIRES_IN = Number(process.env.OTP_EMAIL_EXPIRES_IN) || 10;
  static OTP_EMAIL_MAX_USAGE = Number(process.env.OTP_EMAIL_MAX_USAGE) || 10;
  static OTP_EMAIL_MAX_USAGE_HOURS =
    Number(process.env.OTP_EMAIL_MAX_USAGE_HOURS) || 24;
  /** @default 10 minutes */
  static OTP_PHONE_EXPIRES_IN = Number(process.env.OTP_PHONE_EXPIRES_IN) || 10;
  static OTP_PHONE_MAX_USAGE = Number(process.env.OTP_PHONE_MAX_USAGE) || 5;
  static OTP_PHONE_MAX_USAGE_HOURS =
    Number(process.env.OTP_PHONE_MAX_USAGE_HOURS) || 24;
  static OTP_MAX_RETRIES = Number(process.env.OTP_MAX_RETRIES) || 3;

  // Firebase
  static FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
  static FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
  static FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;

  // HTTP
  static HTTP_TIME_OUT = Number(process.env.HTTP_TIME_OUT);

  // Facebook
  static FACEBOOK_HOST = process.env.FB_HOST;
  static FACEBOOK_CLIENT_ID = process.env.FB_CLIENT_ID;
  static FACEBOOK_CLIENT_SECRET = process.env.FB_CLIENT_SECRET;
  static FACEBOOK_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

  // Telegram
  static TELEGRAM_BOT_TOKEN = process.env.TG_BOT_TOKEN;

  // Apple
  static APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
  static APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
  static APPLE_KEY_IDENTIFIER = process.env.APPLE_KEY_IDENTIFIER;
  static APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;

  // Twilio
  static TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'ACd501e';
  static TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'secret';
  static TWILIO_OTP_SID = process.env.TWILIO_OTP_SID || 'VA356353';
  static TWILIO_COUNTRY_CODES = (
    process.env.TWILIO_COUNTRY_CODE || '+62,+91,+880'
  ).split(',');

  // Youtube
  static YOUTUBE_VERIFY_TOKEN = process.env.YOUTUBE_VERIFY_TOKEN;
  static YOUTUBE_WEBHOOK_CALLBACK = process.env.YOUTUBE_WEBHOOK_CALLBACK;

  // ip-api
  static IP_API_URL = process.env.IP_API_URL || 'https://ip-api.com/json';
  static IP_API_KEY = process.env.IP_API_KEY || null;

  // Google
  static GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  static GOOGLE_SECRET = process.env.GOOGLE_SECRET;

  // Feed Setting
  static FEED_FOLLOW_MAX = Number(
    process.env.FEED_FOLLOW_MAX || Configs.Feed.FollowFeedMax,
  );
  static FEED_FOLLOW_RATIO = Number(
    process.env.FEED_FOLLOW_RATIO || Configs.Feed.FollowFeedRatio,
  );
  static FEED_DECAY_DAYS = Number(
    process.env.FEED_DECAY_DAYS || Configs.Feed.DecayDays,
  );
  static FEED_DUPLICATE_MAX = Number(
    process.env.FEED_DUPLICATE_MAX || Configs.Feed.DuplicateContentMax,
  );
  static FEED_CALLED_AT_DELAY = Number(
    process.env.FEED_CALLED_AT_DELAY || Configs.Feed.CalledAtDelay,
  );
  static FEED_IGNORE_PERSONALIZED_CONTENTS =
    process.env.FEED_IGNORE_PERSONALIZED_CONTENTS || 0;

  // Links
  static LINK_INVITE_FRIENDS = process.env.LINK_INVITE_FRIENDS;
  static LINK_VERIFIED_EMAIL =
    process.env.LINK_VERIFIED_EMAIL ||
    'https://links.castcle.com/verified-email';

  /**
   * Number of digits after the decimal point
   * @default 8
   */
  static DECIMALS_FLOAT = Number(process.env.DECIMALS_FLOAT || 8);

  // DS Service
  static DS_SERVICE_BASE_URL = process.env.DS_SERVICE_BASE_URL;

  // Rate Limiting
  static RATE_LIMIT_TTL = Number(process.env.RATE_LIMIT_TTL) || 300;
  static RATE_LIMIT_LIMIT = Number(process.env.RATE_LIMIT_LIMIT) || 200;
  static RATE_LIMIT_OTP_TTL = Number(process.env.RATE_LIMIT_OTP_TTL) || 60;
  static RATE_LIMIT_OTP_LIMIT = Number(process.env.RATE_LIMIT_OTP_LIMIT) || 20;
  static RATE_LIMIT_OTP_EMAIL_TTL =
    Number(process.env.RATE_LIMIT_OTP_EMAIL_TTL) || 60;
  static RATE_LIMIT_OTP_EMAIL_LIMIT =
    Number(process.env.RATE_LIMIT_OTP_EMAIL_LIMIT) || 20;
  static RATE_LIMIT_OTP_MOBILE_TTL =
    Number(process.env.RATE_LIMIT_OTP_MOBILE_TTL) || 300;
  static RATE_LIMIT_OTP_MOBILE_LIMIT =
    Number(process.env.RATE_LIMIT_OTP_MOBILE_LIMIT) || 1;

  // AWS Xray
  static AWS_XRAY_DAEMON_ADDRESS = process.env.AWS_XRAY_DAEMON_ADDRESS;

  // RECAPTCHA
  static RECAPTCHA_API_KEY = process.env.RECAPTCHA_API_KEY || 'api-key';
  static RECAPTCHA_PROJECT_ID = process.env.RECAPTCHA_PROJECT_ID || 'pid';
  static RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || 'site-key';

  // Castcle ID Update
  static CASTCLE_ID_ALLOW_UPDATE_DAYS =
    Number(process.env.CASTCLE_ID_ALLOW_UPDATE_DAYS) || 60;

  // ADS
  static ADS_MINIMUM_CPM = Number(process.env.ADS_MINIMUM_CPM) || 0.001;
  static ADS_MINIMUM_FEED_VIEW = process.env.ADS_MINIMUM_FEED_VIEW || 6;
  static ADS_MINIMUM_FEED_COOL_DOWN =
    process.env.ADS_MINIMUM_FEED_COOL_DOWN || 15000;

  //  Notify
  static NOTIFY_LIKE = process.env.NOTIFY_LIKE || 0;
  static NOTIFY_RECAST = process.env.NOTIFY_RECAST || 0;
  static NOTIFY_QUOTE = process.env.NOTIFY_QUOTE || 0;
  static NOTIFY_COMMENT = process.env.NOTIFY_COMMENT || 0;
  static NOTIFY_TAG = process.env.NOTIFY_TAG || 0;
  static NOTIFY_FARM = process.env.NOTIFY_FARM || 0;
  static NOTIFY_REPLY = process.env.NOTIFY_REPLY || 0;
  static NOTIFY_ADS = process.env.NOTIFY_ADS || 0;
  static NOTIFY_FOLLOW = process.env.NOTIFY_FOLLOW || 0;
  static NOTIFY_SYSTEM = process.env.NOTIFY_SYSTEM || 0;

  /**
   * Notify follow interval: value of hour ex. 1
   * @default 0 hour
   */
  static NOTIFY_FOLLOW_INTERVAL = process.env.NOTIFY_FOLLOW_INTERVAL || 0;

  static CONTENT_FARMING_COOLDOWN_HR = Number(
    process.env.CONTENT_FARMING_COOLDOWN_HR || 1 / 60 / 1000,
  ); //hours

  // Setting cache content
  static LIMIT_CONTENT = Number(process.env.LIMIT_CONTENT) || 2000;
  static DECAY_DAY_CONTENT = Number(process.env.DECAY_DAY_CONTENT) || 7;

  // Generate QRCode
  static QR_CODE_REDIRECT_URL = process.env.QR_CODE_REDIRECT_URL || '';

  /** List of dates for each PDPA version (latest first) */
  static PDPA_ACCEPT_DATES = (process.env.PDPA_ACCEPT_DATE || '')
    .split(',')
    .sort((a, b) => b.localeCompare(a));

  //Backoffice
  static BACKOFFICE_API_KEY = process.env.BACKOFFICE_API_KEY || '';
  static BACKOFFICE_JWT_ACCESS_SECRET =
    process.env.BACKOFFICE_JWT_ACCESS_SECRET || 'secret';
  static BACKOFFICE_DB_DATABASE_NAME =
    process.env.BACKOFFICE_DB_DATABASE_NAME || '';
  static BACKOFFICE_JWT_ACCESS_EXPIRES_IN = Number(
    process.env.BACKOFFICE_JWT_ACCESS_EXPIRES_IN || 1000 * 60,
  );
  static BACKOFFICE_DB_USERNAME = process.env.BACKOFFICE_DB_USERNAME;
  static BACKOFFICE_DB_PASSWORD = process.env.BACKOFFICE_DB_PASSWORD;
  static BACKOFFICE_DB_HOST = process.env.BACKOFFICE_DB_HOST;
  static BACKOFFICE_CLOUDFRONT_ACCESS_KEY_ID =
    process.env.BACKOFFICE_CLOUDFRONT_ACCESS_KEY_ID;
  static BACKOFFICE_CLOUDFRONT_PRIVATE_KEY =
    process.env.BACKOFFICE_CLOUDFRONT_PRIVATE_KEY;

  private static BACKOFFICE_DB_AUTHENTICATION =
    Environment.BACKOFFICE_DB_USERNAME && Environment.BACKOFFICE_DB_PASSWORD
      ? `${Environment.BACKOFFICE_DB_USERNAME}:${Environment.BACKOFFICE_DB_PASSWORD}@`
      : '';
  static BACKOFFICE_DB_URI = `${Environment.DB_FORMAT}://${Environment.BACKOFFICE_DB_AUTHENTICATION}${Environment.BACKOFFICE_DB_HOST}/${Environment.BACKOFFICE_DB_DATABASE_NAME}?retryWrites=true&w=majority`;
  static BACKOFFICE_APP_DB_URI = `${Environment.DB_FORMAT}://${Environment.BACKOFFICE_DB_AUTHENTICATION}${Environment.BACKOFFICE_DB_HOST}/${Environment.DB_DATABASE_NAME}?retryWrites=true&w=majority`;

  // Chain internal name
  static CHAIN_INTERNAL = process.env.CHAIN_INTERNAL;
}
