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

import { AuthenticationService } from '@castcle-api/database';
import { HttpService } from '@nestjs/axios';
import { Environment as env } from '@castcle-api/environments';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { CredentialRequest } from '../..';
import * as util from '../util';
import { lastValueFrom, map } from 'rxjs';
import { CredentialDocument } from '@castcle-api/database/schemas';

type CheckIp = {
  countryCode: string;
  continentCode: string;
};

const getIPUrl = (ip: string) =>
  env.IP_API_KEY
    ? `${env.IP_API_URL}/${ip}?fields=continentCode,countryCode&key=${env.IP_API_KEY}`
    : `${env.IP_API_URL}/${ip}?fields=continentCode,countryCode`;

@Injectable()
export class IpTrackerInterceptor implements NestInterceptor {
  constructor(
    private authService: AuthenticationService,
    private httpService: HttpService
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    let credential: CredentialDocument;
    if (request.$credential)
      credential = (request as CredentialRequest).$credential;
    else if (request.body && request.body.deviceUUID) {
      credential = await this.authService.getGuestCredentialFromDeviceUUID(
        request.body.deviceUUID
      );
    } else {
      const token = util.getTokenFromRequest(request);
      credential = await this.authService.getCredentialFromAccessToken(token);
    }

    request.$ip = util.getIpFromRequest(request);
    try {
      request.$geolocation = await lastValueFrom(
        this.httpService.get<CheckIp>(getIPUrl(request.$ip)).pipe(
          map(
            ({ data }) =>
              ({
                continentCode: data.continentCode.toLowerCase(),
                countryCode: data.countryCode.toLowerCase(),
              } as CheckIp)
          )
        )
      );
    } catch (error) {
      console.debug('wrong ip', request.$ip);
    }
    try {
      console.log('update ip ', credential.accessToken);
      const account = await this.authService.getAccountFromCredential(
        credential
      );
      account.geolocation = request.$geolocation;
      account.save();
    } catch (error) {
      console.debug('wrong credential');
    }

    return next.handle();
  }
}
