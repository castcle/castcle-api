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

import { connect, disconnect, model, PipelineStage, Schema } from 'mongoose';

class CreateCampaigns {
  static run = async () => {
    const args = {} as Record<string, string>;
    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);
      if (v) args[v[1]] = v[2];
    });

    const dbName = args.dbName || 'test';
    const url = args.url || `mongodb://localhost:27017/${dbName}`;
    await connect(url);
    const txModel = model('Transaction', transactionSchema);
    const $unset = ['data.campaignId', 'data.type', 'data.filter'];

    while (true) {
      const updatePipeline = await txModel.aggregate(pipeline).limit(500);
      if (!updatePipeline.length) break;
      console.info(`updated: ${JSON.stringify(updatePipeline)}`);
      const $update = updatePipeline.map(({ _id, ...$set }) => {
        return txModel.findByIdAndUpdate(_id, { $set, $unset });
      });
      await Promise.all($update);
      console.info(`updated: ${updatePipeline.length}`);
    }

    await disconnect();
  };
}

const transactionSchema = new Schema({
  to: Array,
  data: Object,
  status: String,
  type: String,
});

const pipeline: PipelineStage[] = [
  { $match: { 'to.account': { $exists: true } } },
  {
    $lookup: {
      from: 'users',
      let: {
        t: '$to.account',
      },
      pipeline: [
        {
          $sort: {
            updatedAt: -1,
          },
        },
        {
          $match: {
            $expr: {
              $and: [
                {
                  $or: [
                    {
                      $in: ['$ownerAccount', '$$t'],
                    },
                  ],
                },
                {
                  $eq: ['$type', 'people'],
                },
              ],
            },
          },
        },
        {
          $limit: 1,
        },
      ],
      as: 'user',
    },
  },
  {
    $project: {
      status: 'verified',
      type: {
        $cond: {
          if: '$data.type',
          then: '$data.type',
          else: 'airdrop',
        },
      },
      'data.campaign': {
        $toObjectId: '$data.campaignId',
      },
      to: {
        $map: {
          input: '$to',
          in: {
            user: {
              $first: '$user._id',
            },
            type: '$$this.type',
            value: {
              $toDecimal: '$$this.value',
            },
          },
        },
      },
    },
  },
];

CreateCampaigns.run().catch(console.error);
