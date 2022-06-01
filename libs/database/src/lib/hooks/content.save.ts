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
import * as mongoose from 'mongoose';
import { EntityVisibility } from '../dtos/common.dto';
import { Content, FeedItem, Relationship, Revision, User } from '../schemas';

type HookModels = {
  revisionModel: Model<Revision>;
  feedItemModel: Model<FeedItem>;
  relationshipModel: Model<Relationship>;
  userModel: Model<User>;
};

/**
 * Main logic of content.post('save) this will create revision document and create contentItems
 * @param doc
 * @param models
 * @returns
 */
export const postContentSave = async (doc: Content, models: HookModels) => {
  new models.revisionModel({
    objectRef: {
      $ref: 'content',
      $id: mongoose.Types.ObjectId((doc as Content)._id),
    },
    payload: doc as Content,
  }).save();

  return true;
};

/**
 * before save a Content Document set document visibility default to publish and default engagement of like,recast,comment,quote to 0
 * @param doc
 * @returns
 */
export const preContentSave = async (doc: Content) => {
  doc.wasNew = doc.isNew;
  doc.visibility = doc.visibility ? doc.visibility : EntityVisibility.Publish;
  doc.revisionCount = doc.revisionCount ? doc.revisionCount + 1 : 1;
  if (!doc.engagements) {
    doc.engagements = {
      like: {
        count: 0,
        refs: [],
      },
      comment: {
        count: 0,
        refs: [],
      },
      recast: {
        count: 0,
        refs: [],
      },
      quote: {
        count: 0,
        refs: [],
      },
    };
  }
  return doc;
};
