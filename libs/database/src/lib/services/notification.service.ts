import { CredentialDocument } from '@castcle-api/database/schemas';
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
  CastcleQueryOptions,
  DEFAULT_QUERY_OPTIONS,
  EntityVisibility
} from '../dtos/common.dto';
import { createPagination } from '../utils/common';
import { NotificationDocument } from './../schemas/notification.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel('Notification')
    public _notificationModel: Model<NotificationDocument>
  ) {}

  getAll = async (
    credential: CredentialDocument,
    options: CastcleQueryOptions = DEFAULT_QUERY_OPTIONS
  ) => {
    const findFilter: {
      'credential.id': any;
      type?: string;
      'account.visibility': EntityVisibility;
    } = {
      'credential.id': credential._id,
      'account.visibility': EntityVisibility.Publish
    };
    if (options.type) findFilter.type = options.type;

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
