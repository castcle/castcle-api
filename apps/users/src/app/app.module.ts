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
import { CastcleCacheModule } from '@castcle-api/environments';
import { UtilsAwsModule } from '@castcle-api/utils/aws';
import { UtilsClientsModule } from '@castcle-api/utils/clients';
import { UtilsInterceptorsModule } from '@castcle-api/utils/interceptors';
import { Module } from '@nestjs/common';
import { NetworksController } from './networks/controller';
import { GetNetworksService } from './networks/services/get-networks/service.abstract';
import { GetNetworksServiceImpl } from './networks/services/get-networks/service.impl';
import { NotificationsControllerV2 } from './notifications/controller.v2';
import { PagesControllerV2 } from './pages/controller.v2';
import { QRCodeControllerV2 } from './qr-codes/controller.v2';
import { UsersControllerV2 } from './users/controller.v2';
import { UpdateMobileService } from './users/services/update-mobile/service.abstract';
import { UpdateMobileServiceImpl } from './users/services/update-mobile/service.implementation';
import { WalletControllerV2 } from './wallets/controller.v2';
import { GetWalletBalanceService } from './wallets/services/get-wallet-balance/service.abstract';
import { GetWalletBalanceServiceImpl } from './wallets/services/get-wallet-balance/service.implementation';
import { ReviewTransactionService } from './wallets/services/review-transaction/service.abstract';
import { ReviewTransactionServiceImpl } from './wallets/services/review-transaction/service.implementation';
import { SendTransactionService } from './wallets/services/send-transaction/service.abstract';
import { SendTransactionServiceImpl } from './wallets/services/send-transaction/service.implementation';

@Module({
  imports: [
    CastcleCacheModule,
    CastcleHealthyModule.register({ pathPrefix: 'users' }),
    CastcleThrottlerModule,
    CastcleTracingModule.forRoot({ serviceName: 'users' }),
    DatabaseModule,
    UtilsAwsModule,
    UtilsClientsModule,
    UtilsInterceptorsModule,
  ],
  controllers: [
    NetworksController,
    NotificationsControllerV2,
    PagesControllerV2,
    QRCodeControllerV2,
    UsersControllerV2,
    WalletControllerV2,
  ],
  providers: [
    {
      provide: GetNetworksService,
      useClass: GetNetworksServiceImpl,
    },
    {
      provide: GetWalletBalanceService,
      useClass: GetWalletBalanceServiceImpl,
    },
    {
      provide: ReviewTransactionService,
      useClass: ReviewTransactionServiceImpl,
    },
    {
      provide: SendTransactionService,
      useClass: SendTransactionServiceImpl,
    },
    {
      provide: UpdateMobileService,
      useClass: UpdateMobileServiceImpl,
    },
  ],
})
export class AppModule {}
