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
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AppleClient } from './apple/apple.client';
import { FacebookClient } from './facebook/facebook.client';
import {
  FacebookAccessToken,
  FacebookTokenData,
  FacebookUserInfo,
} from './facebook/facebook.message';
import { GoogleClient } from './google/google.client';
import { TelegramClient } from './telegram/telegram.client';
import { TelegramUserInfo } from './telegram/telegram.message';
import { TwillioClient } from './twillio/twillio.client';
import { TwillioChannel } from './twillio/twillio.message';
import { TwitterClient } from './twitter/twitter.client';
import { TwitterAccessToken, TwitterUserData } from './twitter/twitter.message';

@Module({
  imports: [
    HttpModule.register({
      timeout: Environment.HTTP_TIME_OUT,
    }),
  ],
  controllers: [],
  providers: [
    FacebookClient,
    TelegramClient,
    TwitterClient,
    TwillioClient,
    AppleClient,
    GoogleClient,
  ],
  exports: [
    HttpModule,
    FacebookClient,
    TelegramClient,
    TwitterClient,
    AppleClient,
    TwillioClient,
    GoogleClient,
  ],
})
export class UtilsClientsModule {}

export {
  FacebookAccessToken,
  FacebookTokenData,
  FacebookClient,
  FacebookUserInfo,
  TelegramClient,
  TelegramUserInfo,
  TwitterClient,
  TwitterAccessToken,
  TwitterUserData,
  AppleClient,
  TwillioClient,
  TwillioChannel,
  GoogleClient,
};
