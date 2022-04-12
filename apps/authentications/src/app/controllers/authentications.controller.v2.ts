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
  AuthenticationService,
  AuthenticationServiceV2,
} from '@castcle-api/database';
import { LoginWithEmailDto } from '@castcle-api/database/dtos';
import { CastLogger } from '@castcle-api/logger';
import {
  CastcleBasicAuth,
  CastcleControllerV2,
  CastcleTrack,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import {
  CredentialRequest,
  TokenInterceptor,
  TokenRequest,
} from '@castcle-api/utils/interceptors';
import { Body, Post, Req, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AppService } from '../app.service';
import { RefreshTokenResponse } from '../dtos';
import { AuthenticationController } from './app.controller';

@CastcleControllerV2({ path: 'authentications' })
export class AuthenticationControllerV2 {
  private logger = new CastLogger(AuthenticationController.name);

  constructor(
    private authenticationService: AuthenticationServiceV2,
    private authenticationServiceV1: AuthenticationService,
    private appService: AppService
  ) {}

  @Post('login-with-email')
  @CastcleBasicAuth()
  @CastcleTrack()
  loginWithEmail(
    @Body() { email, password }: LoginWithEmailDto,
    @Req() { $credential }: CredentialRequest
  ) {
    return this.authenticationService.loginWithEmail(
      $credential,
      email,
      password
    );
  }

  @ApiResponse({
    status: 201,
    type: RefreshTokenResponse,
  })
  @ApiResponse({
    status: 400,
    description:
      'will show if some of header is missing or invalid refresh token',
  })
  @ApiBearerAuth()
  @UseInterceptors(TokenInterceptor)
  @Post('refresh-token')
  async refreshToken(@Req() req: TokenRequest) {
    /*
     * TODO: !!!
     * should embed  account and user for better performance
     */
    const credential =
      await this.authenticationServiceV1.getCredentialFromRefreshToken(
        req.$token
      );
    if (credential && credential.isRefreshTokenValid()) {
      const userProfile = await this.appService.getUserProfile(credential);
      this.logger.log('Validate profile member.');
      if (!userProfile.profile && !credential.account.isGuest) {
        this.logger.warn('Member Profile is empty.');
        throw CastcleException.INVALID_REFRESH_TOKEN;
      }

      const accessTokenPayload =
        await this.authenticationServiceV1.getAccessTokenPayloadFromCredential(
          credential
        );

      const newAccessToken = await credential.renewAccessToken(
        accessTokenPayload
      );

      const account = await this.authenticationServiceV1.getAccountFromId(
        credential.account._id
      );
      return {
        profile: userProfile.profile
          ? await userProfile.profile.toUserResponse({
              passwordNotSet: account.password ? false : true,
              mobile: account.mobile,
            })
          : null,
        pages: userProfile.pages
          ? userProfile.pages.items.map((item) => item.toPageResponse())
          : null,
        accessToken: newAccessToken,
      } as RefreshTokenResponse;
    }
    throw CastcleException.INVALID_REFRESH_TOKEN;
  }
}
