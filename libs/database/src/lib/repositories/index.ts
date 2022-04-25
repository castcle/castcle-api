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

import { AVATAR_SIZE_CONFIGS, Image } from '@castcle-api/utils/aws';
import { CastcleName, CastcleRegExp } from '@castcle-api/utils/commons';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isMongoId } from 'class-validator';
import {
  AnyKeys,
  FilterQuery,
  Model,
  QueryOptions,
  UpdateQuery,
} from 'mongoose';
import { lastValueFrom, map } from 'rxjs';
import { EntityVisibility } from '../dtos';
import { UserType } from '../models';
import { Account, User } from '../schemas';

type AccountQuery = {
  _id?: string;
  email?: string;
  provider?: string;
  socialId?: string;
};

type UserQuery = {
  /** Mongo ID or castcle ID */
  _id?: string;
  accountId?: string;
  type?: UserType;
};

@Injectable()
export class Repository {
  constructor(
    @InjectModel('Account') private accountModel: Model<Account>,
    @InjectModel('User') private userModel: Model<User>,
    private httpService: HttpService
  ) {}

  private getBase64FromUrl(url: string) {
    return lastValueFrom(
      this.httpService
        .get(url, {
          responseType: 'arraybuffer',
        })
        .pipe(map(({ data }) => Buffer.from(data, 'binary').toString('base64')))
    );
  }

  private getAccountQuery(filter: AccountQuery) {
    const query: FilterQuery<Account> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter._id) query._id = filter._id;
    if (filter.email) query.email = CastcleRegExp.fromString(filter.email);
    if (filter.provider && filter.socialId) {
      query[`authentications.${filter.provider}.socialId`] = filter.socialId;
    }

    return query;
  }

  deleteAccount(filter: AccountQuery) {
    return this.accountModel.deleteOne(this.getAccountQuery(filter));
  }

  findAccount(filter: AccountQuery) {
    return this.accountModel.findOne(this.getAccountQuery(filter));
  }

  findAccounts(filter: AccountQuery) {
    return this.accountModel.find(this.getAccountQuery(filter));
  }

  updateAccount(filter: AccountQuery, updateQuery: UpdateQuery<Account>) {
    return this.accountModel.updateOne(
      this.getAccountQuery(filter),
      updateQuery
    );
  }

  async createProfileImage(accountId: string, imageUrl: string) {
    const base64 = await this.getBase64FromUrl(imageUrl);
    const { image } = await Image.upload(base64, {
      filename: `avatar-${accountId}`,
      addTime: true,
      sizes: AVATAR_SIZE_CONFIGS,
      subpath: `account_${accountId}`,
    });

    return image;
  }

  async createUser(user: AnyKeys<User>) {
    if (user.displayId) {
      const { suggestCastcleId } = new CastcleName(user.displayName);
      const query = this.getUserQuery({ _id: suggestCastcleId });
      const totalUser = await this.userModel.countDocuments(query);
      user.displayName = totalUser
        ? user.displayName + totalUser
        : suggestCastcleId;
    }

    return new this.userModel(user).save();
  }

  private getUserQuery(filter: UserQuery) {
    const query: FilterQuery<User> = {
      visibility: EntityVisibility.Publish,
    };

    if (filter.accountId) query.ownerAccount = filter.accountId as any;
    if (filter.type) query.type = filter.type;
    if (isMongoId(String(filter._id))) query._id = filter._id;
    else if (filter._id) query.displayId = CastcleRegExp.fromString(filter._id);

    return query;
  }

  findUser(filter: UserQuery, queryOptions?: QueryOptions) {
    return this.userModel.findOne(this.getUserQuery(filter), {}, queryOptions);
  }

  findUsers(filter: UserQuery, queryOptions?: QueryOptions) {
    return this.userModel.find(this.getUserQuery(filter), {}, queryOptions);
  }
}
