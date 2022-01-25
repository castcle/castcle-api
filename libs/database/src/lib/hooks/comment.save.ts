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
import { EntityVisibility } from '../dtos';
import { CommentDocument, Comment, ContentDocument } from '../schemas';
import { RevisionDocument } from '../schemas/revision.schema';

type HookModels = {
  revisionModel: Model<RevisionDocument>;
  contentModel: Model<ContentDocument>;
};
/**
 * before save a Comment Document set document visibility default to publish and default engagement of like,recast,comment,quote to 0
 * @param doc
 * @returns
 */
export const preCommentSave = async (doc: CommentDocument) => {
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
    };
  }
  console.debug('preDoc', doc);
  return doc;
};

export const postCommentSave = async (
  doc: CommentDocument,
  models: HookModels
) => {
  const session = await models.revisionModel.startSession();

  session.withTransaction(async () => {
    //update revision
    await new models.revisionModel({
      objectRef: {
        $ref: 'comment',
        $id: mongoose.Types.ObjectId(doc._id),
      },
      payload: doc as Comment,
    }).save();
    //f content not publish go remove all content
    if (doc.visibility != EntityVisibility.Publish) {
      //if this is quote cast
    }
  });
  session.endSession();

  return true;
};
