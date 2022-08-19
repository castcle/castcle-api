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

import { connect, disconnect, model, Schema, Types } from 'mongoose';
import { SchemaTypes } from 'mongoose';

async function migrate() {
  const args = {} as Record<string, string>;

  process.argv.forEach((arg) => {
    const v = arg.match(/--(\w+)=(.+)/);
    if (v) args[v[1]] = v[2];
  });

  const dbName = args['dbName'] || 'test';
  const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
  await connect(url);

  const feedItemModel = model<any>(
    'FeedItem',
    new Schema({ content: SchemaTypes.ObjectId }),
  );

  for (let skip = 0, limit = 1000; ; skip += limit) {
    const feedItems = await feedItemModel.aggregate([
      {
        $sort: { _id: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'contents',
          let: { content: '$content' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$content'] },
                    { $ne: ['$visibility', 'publish'] },
                  ],
                },
              },
            },
          ],
          as: 'contents',
        },
      },
      {
        $unwind: {
          path: '$contents',
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    const feedId = await Promise.all(
      feedItems
        .filter((feedItem) => feedItem.contents)
        .map(async (feedItem) => feedItem._id),
    );

    if (feedId.length) {
      console.log(`Content not publish : ${feedId.length}`);
      const deleteFeed = await feedItemModel.deleteMany({ _id: feedId }).exec();
      console.log(`Delete count ${deleteFeed.deletedCount}`);
    }

    console.log({ skip, limit, affected: feedItems.length });
    if (feedItems.length < limit) break;
  }

  await disconnect();
}

migrate().catch(console.error);
