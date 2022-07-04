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
import { Environment } from '@castcle-api/environments';
import { CastLogger } from '@castcle-api/logger';
import { HttpService } from '@nestjs/axios';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { getClientIp } from 'request-ip';
import { lastValueFrom, map } from 'rxjs';
import { CredentialRequest } from '../credential/credential.interceptor';
import { getTokenFromRequest } from '../util';

@Injectable()
export class IpTrackerInterceptor implements NestInterceptor {
  #logger = new CastLogger(IpTrackerInterceptor.name);
  #getIPUrl = (ip: string) =>
    Environment.IP_API_KEY
      ? `${Environment.IP_API_URL}/${ip}?fields=continentCode,countryCode&key=${Environment.IP_API_KEY}`
      : `${Environment.IP_API_URL}/${ip}?fields=continentCode,countryCode`;

  constructor(
    private authService: AuthenticationService,
    private httpService: HttpService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();

    try {
      request.$ip = getClientIp(request);
      request.$geolocation = await lastValueFrom(
        this.httpService
          .get<{ countryCode: string; continentCode: string }>(
            this.#getIPUrl(request.$ip),
          )
          .pipe(
            map(({ data }) => {
              this.#logger.log(
                JSON.stringify(data),
                `${request.$ip}:get-geolocation`,
              );

              return {
                continentCode: data.continentCode.toLowerCase(),
                countryCode: data.countryCode.toLowerCase(),
              };
            }),
          ),
      );
    } catch (error: unknown) {
      this.#logger.error(error, `${request.$ip}:get-geolocation`);
    }

    try {
      const credential = request.$credential
        ? (request as CredentialRequest).$credential
        : request.body?.deviceUUID
        ? await this.authService.getGuestCredentialFromDeviceUUID(
            request.body.deviceUUID,
          )
        : await this.authService.getCredentialFromAccessToken(
            getTokenFromRequest(request),
          );

      const account = await this.authService.getAccountFromCredential(
        credential,
      );

      await account.set({ geolocation: request.$geolocation }).save();
      await credential
        .set({ 'account.geolocation': request.$geolocation })
        .save();

      this.#logger.log(
        JSON.stringify(account),
        `${request.$ip}:update-geolocation`,
      );
    } catch (error: unknown) {
      this.#logger.error(error, `${request.$ip}:update-geolocation`);
    }

    return next.handle();
  }
}
