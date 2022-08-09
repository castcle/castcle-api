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
  AdsBoostStatus,
  AdsQuery,
  AdsRequestDto,
  AdsService,
  AdsStatus,
  User,
  UserServiceV2,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  Auth,
  Authorizer,
  CastcleBasicAuth,
  CastcleClearCacheAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

@CastcleControllerV2({ path: 'ads' })
export class AdsController {
  constructor(
    private adsService: AdsService,
    private userService: UserServiceV2,
  ) {}
  private logger = new CastLogger(AdsController.name);

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @Delete(':id')
  async deleteAds(@Auth() { user }: Authorizer, @Param('id') adsId: string) {
    const adsCampaign = await this.adsService.lookupAds(user, adsId);
    if (!adsCampaign) {
      throw new CastcleException('FORBIDDEN');
    }
    await this.adsService.deleteAdsById(adsId);
  }

  _verifyAdsApprove = async (user: User, adsId: string) => {
    const adsCampaign = await this.adsService.lookupAds(user, adsId);
    if (!adsCampaign || adsCampaign.status !== AdsStatus.Approved) {
      this.logger.log('Ads campaign not found.');
      console.log('Ads campaign not found.');
      throw new CastcleException('FORBIDDEN');
    }
    return adsCampaign;
  };

  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  @CastcleBasicAuth()
  @Put(':id/running')
  async adsRunning(@Auth() authorizer: Authorizer, @Param('id') adsId: string) {
    authorizer.requireActivation();
    const adsCampaign = await this._verifyAdsApprove(authorizer.user, adsId);

    if (adsCampaign.boostStatus !== AdsBoostStatus.Pause) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('ADS_BOOST_STATUS_MISMATCH');
    }

    await this.adsService.updateAdsBoostStatus(
      adsCampaign._id,
      AdsBoostStatus.Running,
    );
  }

  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  @CastcleBasicAuth()
  @Put(':id/pause')
  async adsPause(@Auth() authorizer: Authorizer, @Param('id') adsId: string) {
    this.logger.log(`Start pause ads.`);
    authorizer.requireActivation();
    const adsCampaign = await this._verifyAdsApprove(authorizer.user, adsId);

    if (adsCampaign.boostStatus !== AdsBoostStatus.Running) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('ADS_BOOST_STATUS_MISMATCH');
    }

    await this.adsService.updateAdsBoostStatus(
      adsCampaign._id,
      AdsBoostStatus.Pause,
    );
  }

  @ApiResponse({ status: 204 })
  @HttpCode(HttpStatus.NO_CONTENT)
  @CastcleBasicAuth()
  @Put(':id/end')
  async adsEnd(@Auth() authorizer: Authorizer, @Param('id') adsId: string) {
    this.logger.log(`Start end ads.`);
    authorizer.requireActivation();
    const adsCampaign = await this._verifyAdsApprove(authorizer.user, adsId);

    if (
      !(
        adsCampaign.boostStatus === AdsBoostStatus.Running ||
        adsCampaign.boostStatus === AdsBoostStatus.Pause
      )
    ) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('ADS_BOOST_STATUS_MISMATCH');
    }

    await this.adsService.updateAdsBoostStatus(
      adsCampaign._id,
      AdsBoostStatus.End,
    );
  }

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @Post('user')
  async createUserAds(
    @Auth() authorizer: Authorizer,
    @Body() adsRequestDto: AdsRequestDto,
  ) {
    authorizer.requireActivation();
    const user = await this.userService.getUser(adsRequestDto.castcleId);
    authorizer.requestAccessForAccount(user.ownerAccount);
    const ad = await this.adsService.createAds(authorizer.user, adsRequestDto);
    const [adResponse] = await this.adsService.convertAdsToAdResponses([ad]);
    return adResponse;
  }

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @Post('cast')
  async createCastAds(
    @Auth() authorizer: Authorizer,
    @Body() adsRequestDto: AdsRequestDto,
  ) {
    authorizer.requireActivation();
    const ad = await this.adsService.createAds(authorizer.user, adsRequestDto);
    const [adResponse] = await this.adsService.convertAdsToAdResponses([ad]);
    return adResponse;
  }

  @CastcleBasicAuth()
  @Get(':id')
  async lookupAds(@Auth() authorizer: Authorizer, @Param('id') adsId: string) {
    authorizer.requireActivation();
    const ad = await this.adsService.lookupAds(authorizer.user, adsId);
    if (!ad) return;
    const [adResponse] = await this.adsService.convertAdsToAdResponses([ad]);
    return adResponse;
  }

  @CastcleBasicAuth()
  @Get()
  async listAds(@Auth() authorizer: Authorizer, @Query() adsQuery: AdsQuery) {
    authorizer.requireActivation();
    const ads = await this.adsService.getListAds(authorizer.user, adsQuery);
    return this.adsService.convertAdsToAdResponses(ads);
  }
}
