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
import { connect, disconnect, model, Schema, SchemaTypes } from 'mongoose';

const AccountReferralSchema = new Schema({
  referrerAccount: SchemaTypes.ObjectId,
  referringAccount: SchemaTypes.ObjectId,
});
const AccountSchema = new Schema({
  referralCount: SchemaTypes.Number,
  referralBy: SchemaTypes.ObjectId,
});

class MigrateReferral {
  static run = async () => {
    const args = {} as Record<string, string>;

    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);

      if (v) args[v[1]] = v[2];
    });

    const dbName = args['dbName'] || 'test';
    const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
    console.log(args['url']);

    await connect(url);
    const accountReferralModel = model(
      'AccountReferral',
      AccountReferralSchema
    );
    const accountModel = model('Account', AccountSchema);
    let limit = 1000;
    let offset = 0;

    while (true) {
      const referrals = await accountReferralModel.aggregate([
        {
          $group: {
            _id: '$referrerAccount',
            prepare: { $addToSet: '$referringAccount' },
          },
        },
        {
          $limit: limit,
        },
        {
          $skip: offset,
        },
      ]);

      if (referrals.length === 0) break;

      console.time(JSON.stringify({ offset }));
      const $referrals = referrals.map(async (item) => {
        const updateBy = accountModel.updateMany(
          { _id: { $in: item.prepare } },
          {
            $set: {
              referralBy: item._id,
              referralCount: 0,
            },
          }
        );
        Logger.log(
          JSON.stringify({ accountId: item.prepare, affected: updateBy.n })
        );
        const updateCount = accountModel.updateOne(
          { _id: item._id },
          {
            $set: {
              referralCount: item.referralCount,
            },
          }
        );

        Logger.log(
          JSON.stringify({ accountId: item._id, affected: updateCount.n })
        );
      });

      await Promise.all($referrals);
      console.timeEnd(JSON.stringify({ offset }));
      offset += limit;
    }

    await disconnect();
  };
}

MigrateReferral.run().catch(console.error);
