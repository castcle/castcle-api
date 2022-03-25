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

const ContentSchema = new Schema({
  author: new Schema({ id: SchemaTypes.ObjectId }),
});
const FeedItemSchema = new Schema({
  author: SchemaTypes.ObjectId,
  content: SchemaTypes.ObjectId,
});

class CreateCampaigns {
  static run = async () => {
    const args = {} as Record<string, string>;

    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);
      if (v) args[v[1]] = v[2];
    });

    const dbName = args['dbName'] || 'test';
    const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
    await connect(url);
    const contentModel = model('Content', ContentSchema);
    const feedModel = model('FeedItem', FeedItemSchema);
    let limit = 1000;
    let offset = 0;

    while (true) {
      const contents = await contentModel.find().limit(limit).skip(offset);

      if (contents.length === 0) break;

      console.time(JSON.stringify({ offset }));
      const $contents = contents.map(async (content) => {
        const updateResult = await feedModel.updateMany(
          { content: content._id, author: { $exists: false } },
          { author: content.author.id }
        );

        Logger.log(
          JSON.stringify({ contentId: content.id, affected: updateResult.n })
        );
      });

      await Promise.all($contents);
      console.timeEnd(JSON.stringify({ offset }));
      offset += limit;
    }

    await disconnect();
  };
}

CreateCampaigns.run().catch(console.error);
