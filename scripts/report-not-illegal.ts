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

import { connect, disconnect, model, Schema } from 'mongoose';

async function migrate() {
  const args = {} as Record<string, string>;

  process.argv.forEach((arg) => {
    const v = arg.match(/--(\w+)=(.+)/);
    if (v) args[v[1]] = v[2];
  });

  const dbName = args['dbName'] || 'test';
  const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
  await connect(url);
  const contentModel = model<any>(
    'Content',
    new Schema({
      visibility: 'string',
      reportedStatus: 'string',
      reportedSubject: 'string',
    }),
  );
  const userModel = model<any>(
    'User',
    new Schema({
      visibility: 'string',
      reportedStatus: 'string',
      reportedSubject: 'string',
    }),
  );

  await Promise.all([migrateContent(contentModel), migrateUser(userModel)]);

  await disconnect();
}

async function migrateUser(userModel: any) {
  for (let skip = 0, limit = 1000; ; skip += limit) {
    const users = await userModel
      .find({
        visibility: 'publish',
        reportedStatus: { $exists: true },
        reportedSubject: { $exists: true },
      })
      .skip(skip)
      .limit(limit);

    const $users = users.map((user) =>
      userModel.updateOne(
        {
          _id: user._id,
        },
        {
          $unset: {
            reportedStatus: 1,
            reportedSubject: 1,
          },
        },
      ),
    );
    await Promise.all($users);

    console.log('user', { skip, limit, affected: users.length });
    if (users.length < limit) break;
  }
}

async function migrateContent(contentModel: any) {
  for (let skip = 0, limit = 1000; ; skip += limit) {
    const contents = await contentModel
      .find({
        visibility: 'publish',
        reportedStatus: { $exists: true },
        reportedSubject: { $exists: true },
      })
      .skip(skip)
      .limit(limit);

    const $contents = contents.map((content) =>
      contentModel.updateOne(
        {
          _id: content._id,
        },
        {
          $unset: {
            reportedStatus: 1,
            reportedSubject: 1,
          },
        },
      ),
    );
    await Promise.all($contents);

    console.log('content', { skip, limit, affected: contents.length });
    if (contents.length < limit) break;
  }
}

migrate().catch(console.error);
