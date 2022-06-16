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

import {
  connect,
  disconnect,
  model,
  Schema,
  SchemaTypes,
  Types,
} from 'mongoose';

async function migrate() {
  const args = {} as Record<string, string>;

  process.argv.forEach((arg) => {
    const v = arg.match(/--(\w+)=(.+)/);
    if (v) args[v[1]] = v[2];
  });

  const dbName = args['dbName'] || 'test';
  const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
  await connect(url);
  const syncModel = model<any>(
    'SocialSync',
    new Schema({ author: { id: String }, user: SchemaTypes.ObjectId }),
  );

  for (let skip = 0, limit = 100; ; skip += limit) {
    const syncs = await syncModel.find({}).skip(skip).limit(limit);

    const $syncs = syncs.map(async (sync) => {
      try {
        sync.user = Types.ObjectId(sync.author.id);
        sync.author = undefined;
        sync.markModified('user');
        return sync.save();
      } catch (e) {
        console.error(e);
      }
    });

    await Promise.all($syncs);

    console.log({ skip, limit, affected: syncs.length });
    if (syncs.length < limit) break;
  }

  await disconnect();
}

migrate().catch(console.error);
