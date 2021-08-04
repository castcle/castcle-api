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

import { Body, Controller, Get, Post, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { CommonDate } from '@castcle-api/commonDate';
import {
  HeadersRequest,
  HeadersInterceptor
} from '@castcle-api/utils/interceptors';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { CastcleStatus, CastcleException } from '@castcle-api/utils/exception';
import { AuthenticationService } from '@castcle-api/database';
import {
  ApiResponse,
  ApiOkResponse,
  ApiHeader,
  ApiBody
} from '@nestjs/swagger';
import {
  GuestLoginDto,
  TokenResponse,
  CheckEmailExistDto,
  CheckingResponse
} from './dtos/dto';
import { HttpCode } from '@nestjs/common';
import { Req } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthenticationService
  ) {}
  private readonly logger = new CastLogger(
    AppController.name,
    CastLoggerOptions
  );

  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiResponse({
    status: 400,
    description: 'will show if some of header is missing'
  })
  @ApiOkResponse({
    status: 201,
    type: CheckingResponse
  })
  @ApiBody({
    type: CheckEmailExistDto
  })
  @Post('checkEmailExists')
  @HttpCode(200)
  async checkEmailExists(
    @Req() req: HeadersRequest,
    @Body('email') email: string
  ) {
    //if there is no email in the request and email is not valid (not email )
    if (!(email && this.authService.validateEmail(email)))
      throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
    try {
      const account = await this.authService.getAccountFromEmail(email);
      return {
        message: 'success message',
        payload: {
          exist: account ? true : false // true=มีในระบบ, false=ไม่มีในระบบ
        }
      };
    } catch (error) {
      throw new CastcleException(CastcleStatus.INVALID_EMAIL, req.$language);
    }
  }

  @Post('login')
  login() {
    return {
      accessToken: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refreshToken: 'dmInNOX3-Pj_52rubA56xY37Na4EW3TPvwsj5SHiPF8'
    };
  }

  @Post('loginWithSocial')
  loginWithSocial() {
    return {
      accessToken: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refreshToken: 'dmInNOX3-Pj_52rubA56xY37Na4EW3TPvwsj5SHiPF8'
    };
  }

  @ApiHeader({
    name: 'Platform',
    description: 'Device platform',
    example: 'iOS',
    required: true
  })
  @ApiHeader({
    name: 'Accept-Language',
    description: 'Device prefered Language',
    example: 'th',
    required: true
  })
  @ApiHeader({
    name: 'Device',
    description: 'Device name',
    example: 'iPhone',
    required: true
  })
  @ApiOkResponse({
    type: TokenResponse
  })
  @ApiBody({
    type: GuestLoginDto
  })
  @ApiResponse({
    status: 400,
    description: 'will show if some of header is missing'
  })
  @UseInterceptors(HeadersInterceptor)
  @Post('guestLogin')
  async guestLogin(@Req() req: HeadersRequest, @Body() body) {
    //before guard
    if (
      !(
        (req.headers as any) &&
        (req.headers as any).platform &&
        (req.headers as any)['device']
      )
    )
      throw new CastcleException(
        CastcleStatus.MISSING_AUTHORIZATION_HEADER,
        req.$language
      );

    const platform: string = (req.headers as any).platform;
    const preferedLangague: string = req.$language;
    const device: string = (req.headers as any)['device'];
    console.log(req.headers);
    console.log(body);
    const deviceUUID = body.deviceUUID;
    const credential = await this.authService.getCredentialFromDeviceUUID(
      deviceUUID
    );
    if (credential) {
      const tokenResult = await credential.renewTokens(
        {
          id: credential.account as unknown as string,
          preferredLanguage: [preferedLangague, preferedLangague],
          role: 'guest'
        },
        {
          id: credential.account as unknown as string,
          role: 'guest'
        }
      );
      return tokenResult;
    } else {
      const result = await this.authService.createAccount({
        device: device,
        deviceUUID: deviceUUID,
        header: { platform: platform },
        languagesPreferences: [preferedLangague, preferedLangague]
      });
      return {
        accessToken: result.credentialDocument.accessToken,
        refreshToken: result.credentialDocument.refreshToken
      };
    }
  }

  @Post('register')
  register() {
    return {
      accessToken: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refreshToken: 'dmInNOX3-Pj_52rubA56xY37Na4EW3TPvwsj5SHiPF8'
    };
  }

  @Post('refreshToken')
  refreshToken() {
    return {
      accessToken: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    };
  }

  @Post('verificationEmail')
  @HttpCode(204)
  verificationEmail() {
    return '';
  }

  @Post('requestLinkVerify')
  @HttpCode(204)
  requestLinkVerify() {
    return '';
  }

  @Post('checkDisplayNameExists')
  checkDisplayNameExists() {
    return {
      message: 'success message',
      payload: {
        exist: true, // true=มีในระบบ, false=ไม่มีในระบบ
        suggestCastcleId: 'castcle-avenger' // กรณีที่ exist=false ให้ ส่ง suggest
      }
    };
  }

  @Post('checkCastcleIdExists')
  checkCastcleIdExists() {
    return {
      message: 'success message',
      payload: {
        exist: true // true=มีในระบบ, false=ไม่มีในระบบ
      }
    };
  }

  @Post('requestOTP')
  requestOTP() {
    return {
      refCode: 'xxxxxxxx', // 8 หลัก
      objective: 'mergeAccount',
      expiresTime: '2021–06–16T11:22:33Z' // 5 นาทีจาก create
    };
  }

  @Post('verificationOTP')
  @HttpCode(204)
  verificationOTP() {
    return '';
  }

  @Post('forgotPasswordRequestOTP')
  forgotPasswordRequestOTP() {
    return {
      refCode: 'xxxxxxxx', // 8 หลัก
      expiresTime: '2021–06–16T11:22:33Z' // 5 นาทีจาก create
    };
  }

  @Get()
  getData() {
    const dt = new CommonDate();
    const birthDay = dt.getDateFormat(
      dt.getDateFromString('1981-11-10', 'YYYY-MM-DD'),
      'DD-MM-YY'
    );
    this.logger.log('Root');
    return this.appService.getData().message + birthDay;
  }
}
