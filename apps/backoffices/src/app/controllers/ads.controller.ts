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

import { AdsService } from '@castcle-api/database';
import { CastcleControllerV2 } from '@castcle-api/utils/decorators';
import { Body, Get, Param, Post, Query } from '@nestjs/common';
import { BackofficeAuth } from '../decorators';
import { RequiredPermissions } from '../guards/permisson.guard';
import { GetAdParam, GetAdsDto, ManageAdDto } from '../models/ads.dto';
import { Permission } from '../models/authentication.enum';

@CastcleControllerV2({ path: 'backoffices/ads' })
export class AdsController {
  constructor(private adsService: AdsService) {}

  @BackofficeAuth()
  @Get()
  async getAds(@Query() dto: GetAdsDto) {
    const ads = await this.adsService.find(dto);
    const adsResponses = await this.adsService.convertAdsToAdResponses(ads);

    return { payload: adsResponses };
  }

  @BackofficeAuth()
  @RequiredPermissions(Permission.Manage)
  @Post(':adId/approve')
  async approveAd(@Param() { adId }: GetAdParam) {
    await this.adsService.approveAd(adId);
  }

  @BackofficeAuth()
  @RequiredPermissions(Permission.Manage)
  @Post(':adId/decline')
  async declineAd(
    @Body() { reason }: ManageAdDto,
    @Param() { adId }: GetAdParam,
  ) {
    await this.adsService.declineAd(adId, reason);
  }
}
