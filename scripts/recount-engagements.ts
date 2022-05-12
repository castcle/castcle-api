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

import { connect, disconnect, model, ObjectId, Schema } from 'mongoose';

class RecountEngagements {
  static run = async () => {
    const args = {} as Record<string, string>;

    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);
      if (v) args[v[1]] = v[2];
    });

    const dbName = args['dbName'] || 'test';
    const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
    await connect(url);
    const contentModel = model(
      'Content',
      new Schema({ engagements: { type: Object } }),
    );
    const engagementModel = model('Engagement', new Schema());
    const limit = Number(args['limit'] || 1000);

    for (let index = 0; ; index += limit) {
      const contents = await contentModel.find().skip(index).limit(limit);
      if (!contents.length) break;
      const contentIds = contents.map((content) => content._id);
      const engagements = await engagementModel.aggregate<{
        _id: ObjectId;
        like: number;
        comment: number;
        recast: number;
        quote: number;
      }>([
        {
          $match: {
            'targetRef.$id': { $in: contentIds },
            visibility: 'publish',
          },
        },
        {
          $group: {
            _id: '$targetRef.$id',
            like: { $sum: { $cond: [{ $eq: ['$type', 'like'] }, 1, 0] } },
            comment: { $sum: { $cond: [{ $eq: ['$type', 'comment'] }, 1, 0] } },
            recast: { $sum: { $cond: [{ $eq: ['$type', 'recast'] }, 1, 0] } },
            quote: { $sum: { $cond: [{ $eq: ['$type', 'quote'] }, 1, 0] } },
          },
        },
      ]);

      const $contents = contents.map(async (content: any) => {
        const engagement = engagements.find(
          (engagement) => String(engagement._id) === content.id,
        );

        content.set({
          'engagements.like.count': engagement?.like || 0,
          'engagements.comment.count': engagement?.comment || 0,
          'engagements.recast.count': engagement?.recast || 0,
          'engagements.quote.count': engagement?.quote || 0,
        });

        return content.getChanges().$set ? content.save().then(() => 1) : 0;
      });

      await Promise.all($contents)
        .then((changes) =>
          console.info(
            JSON.stringify({
              index,
              limit,
              effected: changes.filter(Boolean).length,
            }),
          ),
        )
        .catch(console.error);
    }

    await disconnect();
  };
}

RecountEngagements.run().catch(console.error);
