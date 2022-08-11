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

class UpdateCastcleId {
  static run = async () => {
    const args = {} as Record<string, string>;

    process.argv.forEach((arg) => {
      const v = arg.match(/--(\w+)=(.+)/);
      if (v) args[v[1]] = v[2];
    });

    const dbName = args['dbName'] || 'test';
    const url = args['url'] || `mongodb://localhost:27017/${dbName}`;
    await connect(url);
    const userModel = model(
      'User',
      new Schema({
        displayId: 'string',
      }),
    );
    const contentModel = model(
      'Content',
      new Schema({
        'author.castcleId': 'string',
      }),
    );

    const reportingModel = model(
      'Reporting',
      new Schema({
        'payload.author.castcleId': 'string',
      }),
    );

    const commentModel = model(
      'Comments',
      new Schema({
        'author.displayId': 'string',
      }),
    );

    const changeUsersTemplate = {
      $set: {
        displayId: {
          $concat: ['@', '$displayId'],
        },
      },
    };

    const changeContentsTemplate = {
      $set: {
        'author.castcleId': {
          $concat: ['@', '$author.castcleId'],
        },
      },
    };

    const changeReportsTemplate = {
      $set: {
        'payload.author.castcleId': {
          $concat: ['@', '$payload.author.castcleId'],
        },
      },
    };

    const changeCommentsTemplate = {
      $set: {
        'author.displayId': {
          $concat: ['@', '$author.displayId'],
        },
      },
    };

    const regexPrefix = new RegExp('^[^@]');

    const changeUserQuery = userModel.updateMany(
      { displayId: { $regex: regexPrefix } },
      [changeUsersTemplate],
      { new: true },
    );

    const changeContentQuery = contentModel.updateMany(
      { 'author.castcleId': { $regex: regexPrefix } },
      [changeContentsTemplate],
      { new: true },
    );

    const changeReportingQuery = reportingModel.updateMany(
      { 'payload.author.castcleId': { $regex: regexPrefix } },
      [changeReportsTemplate],
      { new: true },
    );

    const changeCommentQuery = commentModel.updateMany(
      { 'author.displayId': { $regex: regexPrefix } },
      [changeCommentsTemplate],
      { new: true },
    );

    await Promise.all([
      changeUserQuery,
      changeContentQuery,
      changeReportingQuery,
      changeCommentQuery,
    ]);

    await disconnect();
  };
}

UpdateCastcleId.run().catch(console.error);
