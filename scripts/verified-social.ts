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

import { Logger } from '@nestjs/common';
import { connect, disconnect, model, Schema, Types } from 'mongoose';
import { EntityVisibility } from '../libs/database/src/lib/dtos/common.dto';
import { AuthenticationProvider } from '../libs/database/src/lib/models/account.enum';

class UpdateCastcleId {
  static run = async () => {
    const args = {} as Record<string, string>;

    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);
      if (v) args[v[1]] = v[2];
    });

    const dbName = args['dbName'] || 'test';
    const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
    await connect(url);
    const userModel = model(
      'User',
      new Schema({
        displayId: 'string',
        ownerAccount: Types.ObjectId,
        email: 'string',
        'verified.social': 'string',
        'verified.email': 'string',
      }),
    );
    const accountModel = model(
      'Account',
      new Schema({
        'author.castcleId': 'string',
      }),
    );

    const socialCondition = Object.values(AuthenticationProvider).map(
      (provider) => {
        return { [`authentications.${provider}`]: { $exists: true } };
      },
    );

    Logger.log('Find account is have provider social');
    const accounts: { _id: Types.ObjectId }[] = await accountModel.aggregate([
      {
        $match: {
          visibility: EntityVisibility.Publish,
          $or: socialCondition,
        },
      },
      { $project: { _id: 1 } },
    ]);

    const accountIds = accounts.map((account) => account._id);

    Logger.log('Update verify social of users');
    await userModel.updateMany({ ownerAccount: { $in: accountIds } }, [
      { $set: { 'verified.social': true } },
    ]);

    Logger.log('Update verify email of users');
    await userModel.updateMany(
      { ownerAccount: { $in: accountIds }, email: { $exists: true } },
      [{ $set: { 'verified.email': true } }],
    );

    await disconnect();
  };
}

UpdateCastcleId.run().catch(console.error);
