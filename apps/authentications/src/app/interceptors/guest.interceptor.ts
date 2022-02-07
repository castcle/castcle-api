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
import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import {
  HeadersInterceptor,
  HeadersRequest,
} from '@castcle-api/utils/interceptors';

type Geolocation = {
  countryCode: string;
  continentCode: string;
};

export interface GuestRequest extends HeadersRequest {
  $platform: string;
  $device: string;
  $ip: string;
  $geolocation?: Geolocation;
}

@Injectable()
export class GuestInterceptor extends HeadersInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const superResult = super.intercept(context, next);
    const request = context.switchToHttp().getRequest();
    request.$device =
      request.headers && request.headers.device
        ? request.headers.device
        : undefined;
    request.$platform =
      request.headers && request.headers.platform
        ? request.headers.platform
        : undefined;
    if (request.$device) {
      return superResult;
    } else {
      throw new CastcleException(
        CastcleStatus.MISSING_AUTHORIZATION_HEADER,
        request.$language
      );
    }
  }
}
