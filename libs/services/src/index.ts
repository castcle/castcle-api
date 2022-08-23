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
import { Module } from '@nestjs/common';
import { ConnectWithSocialService } from './lib/authentications/connect-with-social/service.abstract';
import { ConnectWithSocialServiceImpl } from './lib/authentications/connect-with-social/service.implementation';
import { GuestLoginService } from './lib/authentications/guest-login/service.abstract';
import { GuestLoginServiceImpl } from './lib/authentications/guest-login/service.implementation';
import { LoginWithEmailService } from './lib/authentications/login-with-email/service.abstract';
import { LoginWithEmailServiceImpl } from './lib/authentications/login-with-email/service.implementation';
import { LoginWithSocialService } from './lib/authentications/login-with-social/service.abstract';
import { LoginWithSocialServiceImpl } from './lib/authentications/login-with-social/service.implementation';
import { RefreshTokenService } from './lib/authentications/refresh-token/service.abstract';
import { RefreshTokenServiceImpl } from './lib/authentications/refresh-token/service.implementation';
import { RegisterWithEmailService } from './lib/authentications/register-with-email/service.abstract';
import { RegisterWithEmailServiceImpl } from './lib/authentications/register-with-email/service.implementation';

@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [
    {
      provide: ConnectWithSocialService,
      useClass: ConnectWithSocialServiceImpl,
    },
    {
      provide: GuestLoginService,
      useClass: GuestLoginServiceImpl,
    },
    {
      provide: LoginWithEmailService,
      useClass: LoginWithEmailServiceImpl,
    },
    {
      provide: LoginWithSocialService,
      useClass: LoginWithSocialServiceImpl,
    },
    {
      provide: RefreshTokenService,
      useClass: RefreshTokenServiceImpl,
    },
    {
      provide: RegisterWithEmailService,
      useClass: RegisterWithEmailServiceImpl,
    },
  ],
  exports: [
    ConnectWithSocialService,
    GuestLoginService,
    LoginWithEmailService,
    LoginWithSocialService,
    RefreshTokenService,
    RegisterWithEmailService,
  ],
})
class CastcleServices {}

export {
  CastcleServices,
  ConnectWithSocialService,
  GuestLoginService,
  LoginWithEmailService,
  LoginWithSocialService,
  RefreshTokenService,
  RegisterWithEmailService,
};
