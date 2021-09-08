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

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEFAULT_NOTIFICATION_QUERY_OPTIONS,
  NotificationQueryOptions
} from '../dtos/notification.dto';
import { CredentialDocument } from '../schemas/credential.schema';
import { UserModel } from '../schemas/user.schema';
import { createPagination } from '../utils/common';
import { NotificationDocument } from './../schemas/notification.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel('Notification')
    public _notificationModel: Model<NotificationDocument>,
    @InjectModel('User')
    public _userModel: UserModel
  ) {}

    /**
   *
   * @param {UserDocument} user
   * @param {NotificationQueryOptions} options contain option for sorting page = skip + 1,
   * @returns {Promise<{items:NotificationDocument[], total:number, pagination: {Pagination}}>}
   */
  getAll = async (
    credential: CredentialDocument,
    options: NotificationQueryOptions = DEFAULT_NOTIFICATION_QUERY_OPTIONS
  ) => {
    const user = await this._userModel
      .findOne({
        ownerAccount: credential.account._id
      })
      .exec();

    const findFilter: {
      sourceUserId: any;
      source: string;
    } = {
      sourceUserId: user ? user._id : '',
      source: options.source
    };
    console.log(findFilter);

    let query = this._notificationModel
      .find(findFilter)
      .skip(options.page - 1)
      .limit(options.limit);
    if (options.sortBy.type === 'desc') {
      query = query.sort(`-${options.sortBy.field}`);
    } else {
      query = query.sort(`${options.sortBy.field}`);
    }
    const totalDocument = await this._notificationModel
      .count(findFilter)
      .exec();
    const result = await query.exec();

    return {
      total: totalDocument,
      items: result,
      pagination: createPagination(options, totalDocument)
    };
  };
}
