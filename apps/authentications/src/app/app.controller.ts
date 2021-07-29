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

import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { CommonDate } from '@castcle-api/commonDate';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { HttpCode } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  private readonly logger = new CastLogger(
    AppController.name,
    CastLoggerOptions
  );

  @Post('checkEmailExists')
  checkEmailExists(){
    return {
      'message': 'success message',
      'payload': {
        'exist': true 
      }
    };
  }

  @Post('login')
  login(){ 
    return {
      'accessToken': 'JWT token',
      'refreshToken': 'JWT token' 
    }; 
  }
  
  @Post('loginWithSocial')
  loginWithSocial(){
    return {
      'accessToken': 'JWT token',
      'refreshToken': 'JWT token',
    };
  }

  @Post('guestLogin')
  guestLogin(){
    return {
      'accessToken': 'JWT token',
      'refreshToken': 'JWT token',
    };
  }

  @Post('register')
  register(){
    return {
      'channel': 'email', // email or mobile
      'payload': {
        'email': 'email@castcle.com',
        'password': 'password', 
        'displayName': 'Castcle Avenger',
        'castcleId': 'castcle-avenger', 
      },
    };
  }

  @Post('refreshToken')
  refreshToken(){
    return {
      'accessToken': 'JWT token',
    };
  }

  @Post('verificationEmail')
  @HttpCode(204)
  verificationEmail(){
    return `this verification is complete`;
  }

  @Post('requestLinkVerify')
  @HttpCode(204)
  requestLinkVerify(){
    return `this verification is complete`;
  }

  @Post('checkDisplayNameExists')
  checkDisplayNameExists(){
    return {
      'message': 'success message',
      'payload': {
        'exist': true, // true=มีในระบบ, false=ไม่มีในระบบ
        'suggestCastcleId': 'castcle-avenger', // กรณีที่ exist=false ให้ ส่ง suggest
      }
    };
  }

  @Post('checkCastcleIdExists')
  checkCastcleIdExists(){
    return {
      'message': 'success message',
      'payload': {
        'exist': true, // true=มีในระบบ, false=ไม่มีในระบบ
      }
    };
  }

  @Post('requestOTP')
  requestOTP(){
    return {
      'refCode': 'xxxxxxxx', // 8 หลัก
      'objective': 'mergeAccount',
      'expiresTime': '2021–06–16T11:22:33Z', // 5 นาทีจาก create
    };
  }

  @Post('verificationOTP')
  @HttpCode(204)
  verificationOTP(){
    return `this otp is verify`;
  }

  @Post('forgotPasswordRequestOTP')
  forgotPasswordRequestOTP(){
    return {
      'refCode': 'xxxxxxxx', // 8 หลัก
      'expiresTime': '2021–06–16T11:22:33Z', // 5 นาทีจาก create
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
