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

import { Account, Credential, User } from '@castcle-api/database';
import { CastcleException } from '@castcle-api/utils/exception';
import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export class Authorizer {
  constructor(
    public account: Account,
    public user: User,
    public credential: Credential,
  ) {}

  /**
   * permit if `accountId` to access is same as ID of authenticated account
   * @param {string | ObjectId} accountId account ID to access
   */
  requestAccessForAccount(accountId: any) {
    if (this.account.id === String(accountId)) return;

    throw new CastcleException('FORBIDDEN');
  }

  /**
   * permit if `userId` to access is `me` (case-insensitive) or same as ID of authenticated user
   * and account is activated
   * @param {string | ObjectId} accountId account ID to access
   */
  requestAccessForContent(accountId: string) {
    this.requireActivation();
    this.requestAccessForAccount(accountId);
  }

  /**
   * permit if `userId` to access is `me` (case-insensitive) or same as ID of authenticated user
   * @param {string} userId user ID to access
   */
  requestAccessForUser(userId: string) {
    if (userId.toLowerCase() === 'me') return;
    if (this.user.displayId === userId) return;
    if (this.user.id === userId) return;

    throw new CastcleException('FORBIDDEN');
  }

  requireActivation() {
    if (this.account.isGuest || !this.account.activateDate) {
      throw new CastcleException('FORBIDDEN');
    }
  }
}

export const Auth = createParamDecorator(
  async (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const account = await request.$account;
    const user = await request.$user;
    const credential = request.$credential;
    return new Authorizer(account, user, credential);
  },
);
