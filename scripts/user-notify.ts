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
  _id: SchemaTypes.ObjectId,
  author: new Schema({ id: SchemaTypes.ObjectId }),
});

const CommentSchema = new Schema({
  _id: SchemaTypes.ObjectId,
  author: new Schema({ _id: SchemaTypes.ObjectId }),
});

const UserSchema = new Schema({
  _id: SchemaTypes.ObjectId,
});

const NotificationSchema = new Schema({
  _id: SchemaTypes.ObjectId,
  user: SchemaTypes.ObjectId,
  profileRef: SchemaTypes.ObjectId,
  contentRef: SchemaTypes.ObjectId,
  replyRef: SchemaTypes.ObjectId,
  commentRef: SchemaTypes.ObjectId,
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

    await connect(url);

    const notificationModel = model('Notification', NotificationSchema);

    const contentModel = model('Content', ContentSchema);

    const commentModel = model('Comment', CommentSchema);

    const userModel = model('User', UserSchema);

    let limit = 1000;
    let offset = 0;

    while (true) {
      const notifications = await notificationModel.aggregate([
        {
          $match: {
            user: { $exists: false },
          },
        },
        {
          $limit: limit,
        },
        {
          $skip: offset,
        },
      ]);

      if (notifications.length === 0) break;

      console.time(JSON.stringify({ offset }));

      const $notifications = notifications.map(async (item) => {
        if (item.profileRef) {
          const user = await userModel.findOne({ _id: item.profileRef });
          if (!user) {
            await notificationModel.deleteOne({ _id: item._id });
          } else {
            const updateResult = await notificationModel.updateOne(
              { _id: item._id },
              { $set: { user: user._id } }
            );
            Logger.log(
              JSON.stringify({ notifyId: item._id, affected: updateResult.n })
            );
          }
        }
        if (item.contentRef && !item.commentRef && !item.replyRef) {
          const content = await contentModel.findOne({ _id: item.contentRef });
          if (!content) {
            await notificationModel.deleteOne({ _id: item._id });
          } else {
            const updateResult = await notificationModel.updateOne(
              { _id: item._id },
              { $set: { user: content.author.id } }
            );
            Logger.log(
              JSON.stringify({ notifyId: item._id, affected: updateResult.n })
            );
          }
        }
        if (item.contentRef && item.commentRef && !item.replyRef) {
          const comment = await commentModel.findOne({ _id: item.commentRef });
          if (!comment) {
            await notificationModel.deleteOne({ _id: item._id });
          } else {
            const updateResult = await notificationModel.updateOne(
              { _id: item._id },
              { $set: { user: comment.author._id } }
            );
            Logger.log(
              JSON.stringify({ notifyId: item._id, affected: updateResult.n })
            );
          }
        }
        if (item.contentRef && item.commentRef && item.replyRef) {
          const reply = await commentModel.findOne({ _id: item.commentRef });
          if (!reply) {
            await notificationModel.deleteOne({ _id: item._id });
          } else {
            const updateResult = await notificationModel.updateOne(
              { _id: item._id },
              { $set: { user: reply.author._id } }
            );
            Logger.log(
              JSON.stringify({ notifyId: item._id, affected: updateResult.n })
            );
          }
        }
      });

      await Promise.all($notifications);
      console.timeEnd(JSON.stringify({ offset }));
      offset += limit;
    }

    await disconnect();
  };
}

MigrateActivation.run().catch(console.error);
