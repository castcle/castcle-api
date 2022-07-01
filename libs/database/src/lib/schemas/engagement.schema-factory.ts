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

import { Model } from 'mongoose';
import { EntityVisibility } from '../dtos';
import { Content } from './content.schema';
import { Engagement, EngagementSchema } from './engagement.schema';

export const EngagementSchemaFactory = (
  contentModel: Model<Content>,
  commentModel: Model<Comment>,
) => {
  EngagementSchema.post('save', async function (doc: Engagement, next) {
    const count = doc.visibility === EntityVisibility.Publish ? 1 : -1;
    const contentInc = { $inc: { [`engagements.${doc.type}.count`]: count } };

    if (['content', 'comment'].includes(doc.targetRef.$ref)) {
      await (doc.targetRef.$ref === 'content'
        ? contentModel
        : commentModel
      ).updateOne({ _id: doc.targetRef.$id }, contentInc);
    } else if (
      doc.targetRef.namespace === 'content' &&
      doc.visibility !== EntityVisibility.Publish
    ) {
      await contentModel.updateOne({ _id: doc.targetRef.oid }, contentInc);
    } else if (
      doc.targetRef.namespace === 'comment' &&
      doc.visibility !== EntityVisibility.Publish
    ) {
      await commentModel.updateOne({ _id: doc.targetRef.oid }, contentInc);
    }

    next();
  });

  EngagementSchema.post('remove', async (doc: Engagement, next) => {
    const contentInc = { $inc: { [`engagements.${doc.type}.count`]: -1 } };

    await (doc.targetRef.namespace === 'content'
      ? contentModel
      : commentModel
    ).updateOne({ _id: doc.targetRef.oid }, contentInc);

    next();
  });

  return EngagementSchema;
};
