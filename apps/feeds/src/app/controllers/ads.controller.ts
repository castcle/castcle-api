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
  AdsCastDto,
  AdsQuery,
  AdsService,
  AdsStatus,
  AdsUserDto,
  ContentServiceV2,
  GetAdsParams,
  Meta,
  ResponseDto,
  User,
  UserServiceV2,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  Auth,
  Authorizer,
  CastcleAuth,
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
  Query,
} from '@nestjs/common';

@CastcleControllerV2({ path: 'ads' })
export class AdsController {
  constructor(
    private adsService: AdsService,
    private userService: UserServiceV2,
    private contentService: ContentServiceV2,
  ) {}
  private logger = new CastLogger(AdsController.name);

  private _verifyAdsApprove = async (user: User, adsId: string) => {
    const adsCampaign = await this.adsService.lookupAds(user, adsId);
    if (adsCampaign?.status !== AdsStatus.Approved) {
      this.logger.log('Ads campaign not found.');
      throw new CastcleException('FORBIDDEN');
    }
    return adsCampaign;
  };

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @Delete(':adsId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAds(
    @Auth() authorizer: Authorizer,
    @Param() { adsId }: GetAdsParams,
  ) {
    authorizer.requireActivation();

    await this.adsService.deleteAdsById(adsId);
  }

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':adsId/running')
  async adsRunning(
    @Auth() authorizer: Authorizer,
    @Param() { adsId }: GetAdsParams,
  ) {
    authorizer.requireActivation();

    const adsCampaign = await this._verifyAdsApprove(authorizer.user, adsId);

    if (adsCampaign.boostStatus !== AdsBoostStatus.Pause) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('ADS_BOOST_STATUS_MISMATCH');
    }

    await this.adsService.adsRunning(adsCampaign);
  }

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':adsId/pause')
  async adsPause(
    @Auth() authorizer: Authorizer,
    @Param() { adsId }: GetAdsParams,
  ) {
    this.logger.log(`Start pause ads.`);
    authorizer.requireActivation();
    const adsCampaign = await this._verifyAdsApprove(authorizer.user, adsId);

    if (adsCampaign.boostStatus !== AdsBoostStatus.Running) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('ADS_BOOST_STATUS_MISMATCH');
    }

    await this.adsService.adsPause(adsCampaign);
  }

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':adsId/end')
  async adsEnd(
    @Auth() authorizer: Authorizer,
    @Param() { adsId }: GetAdsParams,
  ) {
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':adsId/cancel')
  async adsCancel(
    @Auth() authorizer: Authorizer,
    @Param() { adsId }: GetAdsParams,
  ) {
    this.logger.log(`Start cancel ads.`);

    authorizer.requireActivation();

    const adsCampaign = await this.adsService.lookupAds(authorizer.user, adsId);

    if (adsCampaign.boostStatus === AdsBoostStatus.Unknown) {
      this.logger.log(
        `Ads boost status mismatch. status : ${adsCampaign.boostStatus}`,
      );
      throw new CastcleException('AD_RUNNING_CAN_NOT_CANCEL');
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
    @Body() adsRequestDto: AdsUserDto,
  ) {
    authorizer.requireActivation();

    const user = await this.userService.getUser(adsRequestDto.castcleId);
    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');
    authorizer.requestAccessForAccount(user.ownerAccount);

    const ad = await this.adsService.createAds(user, adsRequestDto);
    const [adResponse] = await this.adsService.convertAdsToAdResponses(
      [ad],
      true,
    );
    return adResponse;
  }

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @Post('cast')
  async createCastAds(
    @Auth() authorizer: Authorizer,
    @Body() adsRequestDto: AdsCastDto,
  ) {
    authorizer.requireActivation();

    const content = await this.contentService.findContent(
      adsRequestDto.contentId,
    );
    if (!content) throw new CastcleException('CONTENT_NOT_FOUND');

    const user = await this.userService.getUser(content.author.id);
    if (!user) throw new CastcleException('USER_OR_PAGE_NOT_FOUND');

    const ad = await this.adsService.createAds(user, adsRequestDto);
    const [adResponse] = await this.adsService.convertAdsToAdResponses([ad]);
    return adResponse;
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get(':adsId')
  async lookupAds(
    @Auth() authorizer: Authorizer,
    @Param() { adsId }: GetAdsParams,
  ) {
    authorizer.requireActivation();

    const ad = await this.adsService.lookupAds(authorizer.user, adsId);
    if (!ad) throw new CastcleException('AD_NOT_FOUND');

    const [adResponse] = await this.adsService.convertAdsToAdResponses(
      [ad],
      true,
    );
    return adResponse;
  }

  @CastcleAuth(CacheKeyName.Users)
  @Get()
  async listAds(@Auth() authorizer: Authorizer, @Query() adsQuery: AdsQuery) {
    authorizer.requireActivation();

    const ads = await this.adsService.getListAds(authorizer.user, adsQuery);
    return ResponseDto.ok({
      payload: await this.adsService.convertAdsToAdResponses(ads),
      meta: Meta.fromDocuments(ads),
    });
  }
}
