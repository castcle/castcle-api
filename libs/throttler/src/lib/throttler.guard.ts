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

import { CastcleException } from '@castcle-api/utils/exception';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';
import { getClientIp } from 'request-ip';

@Injectable()
export class CastcleThrottlerGuard extends ThrottlerGuard {
  override throwThrottlingException(): void {
    throw new CastcleException('RATE_LIMIT_REQUEST');
  }

  override getTracker(req: FastifyRequest): string {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'];
    const defaultTracker = `${ip}-${userAgent}`;

    return [
      defaultTracker,
      ...this.getTrackers(req.routerPath, req.body ?? {}),
    ].join('-');
  }

  private getTrackers(path: string, body: any) {
    if (path.includes('request-otp/email')) {
      return [body.objective, body.email];
    }
    if (path.includes('request-otp/mobile')) {
      return [body.objective, body.mobileNumber];
    }
    if (path.includes('verify-otp/email')) {
      return [body.objective, body.email];
    }
    if (path.includes('verify-otp/mobile')) {
      return [body.objective, body.mobileNumber];
    }
    if (path.includes('change-password')) {
      return [body.objective, body.email];
    }
    if (path.includes('verify-password')) {
      return [body.objective, body.email];
    }
    if (path.includes('me/mobile')) {
      return [body.objective, body.mobileNumber];
    }

    return [];
  }
}
