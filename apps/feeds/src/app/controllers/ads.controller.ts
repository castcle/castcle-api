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
  AdsRequestDto,
  AdsService,
  ContentServiceV2,
  UserServiceV2,
} from '@castcle-api/database';
import { CacheKeyName } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import {
  Auth,
  Authorizer,
  CastcleClearCacheAuth,
  CastcleControllerV2,
} from '@castcle-api/utils/decorators';
import { Body, Post } from '@nestjs/common';

@CastcleControllerV2({ path: 'ads' })
export class AdsController {
  private logger = new CastLogger(AdsController.name);

  constructor(
    private adsService: AdsService,
    private userService: UserServiceV2,
    private contentService: ContentServiceV2,
  ) {}

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @Post('user')
  async createUserAds(
    @Auth() authorizer: Authorizer,
    @Body() adsRequestDto: AdsRequestDto,
  ) {
    this.logger.log('creatcreateUserAds()', JSON.stringify(adsRequestDto));
    authorizer.requireActivation();
    const user = await this.userService.getUser(adsRequestDto.castcleId);
    authorizer.requestAccessForAccount(user.ownerAccount);
    const ads = await this.adsService.createAds(authorizer.user, adsRequestDto);
    return this.adsService.transformAdsCampaignToAdsResponse(ads);
  }

  @CastcleClearCacheAuth(CacheKeyName.Feeds)
  @Post('cast')
  async createCastAds(
    @Auth() authorizer: Authorizer,
    @Body() adsRequestDto: AdsRequestDto,
  ) {
    this.logger.log('createCastAds()', JSON.stringify(adsRequestDto));
    authorizer.requireActivation();
    const ads = await this.adsService.createAds(authorizer.user, adsRequestDto);
    return this.adsService.transformAdsCampaignToAdsResponse(ads);
  }
}
