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

const AccountActivationSchema = new Schema({
  account: new Schema({ id: SchemaTypes.ObjectId }),
  type: SchemaTypes.String,
  verifyToken: SchemaTypes.String,
  verifyTokenExpireDate: SchemaTypes.Date,
  activationDate: SchemaTypes.Date,
  revocationDate: SchemaTypes.Date,
});
const AccountSchema = new Schema({
  activations: SchemaTypes.Array,
});

class MigrateActivation {
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
    const accountActivisionModel = model(
      'AccountActivation',
      AccountActivationSchema
    );
    const accountModel = model('Account', AccountSchema);
    let limit = 1000;
    let offset = 0;

    while (true) {
      const activations = await accountActivisionModel.aggregate([
        {
          $group: {
            _id: '$account',
            prepare: {
              $push: {
                type: '$type',
                verifyToken: '$verifyToken',
                verifyTokenExpireDate: '$verifyTokenExpireDate',
                activationDate: '$activationDate',
                revocationDate: '$revocationDate',
              },
            },
          },
        },
        {
          $limit: limit,
        },
        {
          $skip: offset,
        },
      ]);

      if (activations.length === 0) break;

      console.time(JSON.stringify({ offset }));
      const $activations = activations.map(async (item) => {
        const updateResult = await accountModel.updateOne(
          { _id: item._id },
          {
            $set: {
              activations: item.prepare,
            },
          }
        );

        Logger.log(
          JSON.stringify({ accountId: item._id, affected: updateResult.n })
        );
      });

      await Promise.all($activations);
      console.timeEnd(JSON.stringify({ offset }));
      offset += limit;
    }

    await disconnect();
  };
}

MigrateActivation.run().catch(console.error);
