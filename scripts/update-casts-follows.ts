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

async function migrate() {
  const args = {} as Record<string, string>;

  process.argv.forEach((arg) => {
    const v = arg.match(/--(\w+)=(.+)/);
    if (v) args[v[1]] = v[2];
  });

  const dbName = args['dbName'] || 'test';
  const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
  await connect(url);
  const contentModel = model<any>('Content', new Schema());
  const relationshipModel = model<any>('Relationship', new Schema({}));
  const userModel = model<any>(
    'User',
    new Schema({
      displayId: 'string',
      visibility: 'string',
      casts: 'number',
      followedCount: 'number',
      followerCount: 'number',
    }),
  );

  const [usersUnpublish, userDelete, relationships] = await Promise.all([
    relationshipModel.aggregate([
      {
        $lookup: {
          from: 'users',
          let: { userId: '$user', visibility: 'publish' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$userId'] },
                    { $ne: ['$visibility', '$$visibility'] },
                  ],
                },
              },
            },
          ],
          as: 'user',
        },
      },
      {
        $unwind: { path: '$user' },
      },
    ]),
    relationshipModel.aggregate([
      {
        $lookup: {
          from: 'users',
          let: {
            userId: '$followedUser',
            visibility: 'publish',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$userId'] }],
                },
              },
            },
          ],
          as: 'followed',
        },
      },
      {
        $unwind: { path: '$followed', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'users',
          let: {
            userId: '$user',
            visibility: 'publish',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$userId'] }],
                },
              },
            },
          ],
          as: 'follower',
        },
      },
      {
        $unwind: { path: '$follower', preserveNullAndEmptyArrays: true },
      },
      {
        $match: {
          $or: [
            { follower: { $exists: false } },
            { followed: { $exists: false } },
          ],
        },
      },
    ]),
    relationshipModel.aggregate([
      {
        $match: {
          $and: [{ following: true }],
          $expr: {
            $eq: ['$user', '$followedUser'],
          },
        },
      },
    ]),
  ]);

  Promise.all([
    relationshipModel.deleteMany({
      _id: relationships.map(({ _id }) => _id),
    }),
    relationshipModel.deleteMany({
      $or: [
        {
          $and: [{ following: true }, { blocking: true }],
        },
        {
          $and: [{ following: true }, { blocked: true }],
        },
      ],
    }),
    relationshipModel.deleteMany({
      _id: userDelete.map(({ _id }) => _id),
    }),
    relationshipModel.deleteMany({
      $or: [
        { user: { $in: usersUnpublish.map((item) => item.user._id) } },
        {
          followedUser: {
            $in: usersUnpublish.map((item) => item.user._id),
          },
        },
      ],
    }),
  ]);

  for (let skip = 0, limit = 1000; ; skip += limit) {
    const users = await userModel.find({}).skip(skip).limit(limit);

    const $users = users.map(async (user) => {
      const [casts, followed, follower] = await Promise.all([
        contentModel.count({
          'author.id': user._id,
          visibility: 'publish',
        }),
        relationshipModel.count({
          user: user._id,
          visibility: 'publish',
          following: true,
        }),
        relationshipModel.count({
          followedUser: user._id,
          visibility: 'publish',
          following: true,
        }),
      ]);

      console.log(
        `Migration
         user: ${user['displayId']} (${user.id})
         casts : ${casts}
         followedCount : ${followed}
         followedCount : ${follower}
         `,
      );

      user['followedCount'] = followed;
      user['followerCount'] = follower;
      user['casts'] = casts;
      return user.save();
    });

    await Promise.all($users);

    console.log({ skip, limit, affected: users.length });
    if (users.length < limit) break;
  }

  await disconnect();
}

migrate().catch(console.error);
