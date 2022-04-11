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

import { AuthenticationServiceV2 } from '@castcle-api/database';
import { LoginWithEmailDto } from '@castcle-api/database/dtos';
import {
  CastcleBasicAuth,
  CastcleControllerV2,
  CastcleTrack,
} from '@castcle-api/utils/decorators';
import { CastcleException } from '@castcle-api/utils/exception';
import {
  CredentialRequest,
  HeadersRequest,
} from '@castcle-api/utils/interceptors';
import { Body, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CheckingResponse, CheckIdExistDto, CheckEmailExistDto } from '../dtos';

@CastcleControllerV2({ path: 'authentications' })
export class AuthenticationControllerV2 {
  constructor(private authenticationService: AuthenticationServiceV2) {}

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

  /**
   *
   * @param req
   * @param param1 id exists
   * @returns status castcle id is Exist true | false
   */
  @ApiOkResponse({
    type: CheckingResponse,
  })
  @Post('exists/castcle-id')
  @HttpCode(200)
  async checkCastcleIdExists(@Body() body: CheckIdExistDto) {
    const user = await this.authenticationService.getExistedUserFromCastcleId(
      body.castcleId
    );
    return {
      message: 'success message',
      payload: {
        exist: user ? true : false, // true=มีในระบบ, false=ไม่มีในระบบ
      },
    } as CheckingResponse;
  }

  /**
   *
   * @param req
   * @param param1 body email
   * @returns status email is Exist true | false
   */
  @ApiResponse({
    status: 400,
    description: 'will show if some of header is missing',
  })
  @ApiOkResponse({
    status: 201,
    type: CheckingResponse,
  })
  @ApiBody({
    type: CheckEmailExistDto,
  })
  @Post('exists/email')
  @HttpCode(200)
  async checkEmailExists(
    @Req() req: HeadersRequest,
    @Body() { email }: CheckEmailExistDto
  ) {
    if (!this.authenticationService.validateEmail(email))
      throw CastcleException.INVALID_EMAIL;
    try {
      const account = await this.authenticationService.getAccountFromEmail(
        email
      );
      return {
        message: 'success message',
        payload: {
          exist: account ? true : false,
        },
      };
    } catch (error) {
      throw CastcleException.INVALID_EMAIL;
    }
  }
}
