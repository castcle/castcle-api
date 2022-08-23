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

import { CastcleLogger } from '@castcle-api/common';
import {
  Account,
  EntityVisibility,
  TokenPayload,
  User,
} from '@castcle-api/database';
import { Environment } from '@castcle-api/environments';
import { CastcleException } from '@castcle-api/utils/exception';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { FastifyRequest } from 'fastify';
import { Model, Types } from 'mongoose';

type AuthRequest = FastifyRequest & { $account: Account; $user?: User };

@Injectable()
export class AuthGuard implements CanActivate {
  private logger = new CastcleLogger(AuthGuard.name);

  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('User') private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.replace(/^bearer /i, '');
    if (!token) throw new CastcleException('MISSING_AUTHORIZATION_HEADERS');
    const language = request.headers['accept-language'];
    if (!language) throw new CastcleException('MISSING_AUTHORIZATION_HEADERS');

    try {
      const { id } = this.verifyToken(token);
      const _id = new Types.ObjectId(id);
      const [account, user] = await Promise.all([
        this.accountModel.findOne({
          _id,
          visibility: EntityVisibility.Publish,
          'credentials.accessToken': token,
          'credentials.accessTokenExpiration': { $gte: new Date() },
        }),
        this.userModel.findOne({
          ownerAccount: _id,
          visibility: EntityVisibility.Publish,
        }),
      ]);

      if (!account) throw new CastcleException('INVALID_ACCESS_TOKEN');

      request.$account = account;
      request.$user = user;

      return true;
    } catch (err) {
      this.logger.error(err);
      throw new CastcleException('INVALID_ACCESS_TOKEN');
    }
  }

  private verifyToken(token: string): TokenPayload {
    return this.jwtService.verify(token, {
      secret: Environment.JWT_ACCESS_SECRET,
    });
  }
}
