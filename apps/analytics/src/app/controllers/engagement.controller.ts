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

import { UxEngagementBody, UxEngagementService } from '@castcle-api/database';
import {
  Auth,
  Authorizer,
  CastcleBasicAuth,
  CastcleController,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import { Body, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@CastcleController({ path: 'engagements', version: '1.0' })
export class EngagementController {
  constructor(private uxEngagementService: UxEngagementService) {}

  @ApiBody({ type: UxEngagementBody })
  @ApiResponse({ status: 204 })
  @CastcleBasicAuth()
  @HttpCode(204)
  @Post()
  async track(@Body() body: UxEngagementBody, @Auth() authorizer: Authorizer) {
    authorizer.requestAccessForAccount(body.accountId);
    const result = this.uxEngagementService.track(body);
    if (result) return '';
    else throw new CastcleException('FORBIDDEN');
  }
}
