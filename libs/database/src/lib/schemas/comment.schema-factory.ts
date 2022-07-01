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

import { Model, Types } from 'mongoose';
import { EntityVisibility } from '../dtos';
import { CommentSchema } from './comment.schema';
import { Revision } from './revision.schema';

export const CommentSchemaFactory = (revisionModel: Model<Revision>) => {
  CommentSchema.pre('save', function (next) {
    this.revisionCount = this.revisionCount ? this.revisionCount + 1 : 1;
    if (!this.visibility) this.visibility = EntityVisibility.Publish;
    if (!this.engagements) {
      this.engagements = {
        like: { count: 0, refs: [] },
        comment: { count: 0, refs: [] },
      };
    }

    next();
  });

  CommentSchema.post('save', async function (doc, next) {
    await new revisionModel({
      objectRef: { $ref: 'comment', $id: Types.ObjectId(doc._id) },
      payload: doc,
    }).save();

    next();
  });

  return CommentSchema;
};
