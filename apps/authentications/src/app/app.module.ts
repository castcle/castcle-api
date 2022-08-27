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

import {
  CastcleHealthyModule,
  CastcleThrottlerModule,
  CastcleTracingModule,
} from '@castcle-api/core';
import { DatabaseModule } from '@castcle-api/database';
import { UtilsAwsModule } from '@castcle-api/utils/aws';
import { UtilsClientsModule } from '@castcle-api/utils/clients';
import { Module } from '@nestjs/common';
import { AuthenticationControllerV2 } from './authentications/app.controller.v2';
import { ConnectWithSocialService } from './authentications/services/connect-with-social/service.abstract';
import { ConnectWithSocialServiceImpl } from './authentications/services/connect-with-social/service.implementation';
import { GuestLoginService } from './authentications/services/guest-login/service.abstract';
import { GuestLoginServiceImpl } from './authentications/services/guest-login/service.implementation';
import { LoginWithEmailService } from './authentications/services/login-with-email/service.abstract';
import { LoginWithEmailServiceImpl } from './authentications/services/login-with-email/service.implementation';
import { LoginWithSocialService } from './authentications/services/login-with-social/service.abstract';
import { LoginWithSocialServiceImpl } from './authentications/services/login-with-social/service.implementation';
import { RefreshTokenService } from './authentications/services/refresh-token/service.abstract';
import { RefreshTokenServiceImpl } from './authentications/services/refresh-token/service.implementation';
import { RegisterWithEmailService } from './authentications/services/register-with-email/service.abstract';
import { RegisterWithEmailServiceImpl } from './authentications/services/register-with-email/service.implementation';

@Module({
  imports: [
    CastcleHealthyModule.register({ pathPrefix: 'authentications' }),
    CastcleThrottlerModule,
    CastcleTracingModule.forRoot({ serviceName: 'authentications' }),
    DatabaseModule,
    UtilsClientsModule,
    UtilsAwsModule,
  ],
  controllers: [AuthenticationControllerV2],
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
})
export class AppModule {}
