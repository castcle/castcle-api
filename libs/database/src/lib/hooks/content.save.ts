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
import { EntityVisibility } from '../dtos/common.dto';
import * as mongoose from 'mongoose';
import { ContentDocument, UserDocument } from '../schemas';
import { RevisionDocument } from '../schemas/revision.schema';
import { Content } from '../schemas/content.schema';
import { RelationshipDocument } from '../schemas/relationship.schema';
import { FeedItemDocument } from '../schemas/feedItem.schema';
import { FeedItemDto } from '../dtos/feedItem.dto';
import { ContentAggregator } from '../aggregator/content.aggregator';

type HookModels = {
  revisionModel: Model<RevisionDocument>;
  feedItemModel: Model<FeedItemDocument>;
  relationshipModel: Model<RelationshipDocument>;
  userModel: Model<UserDocument>;
};
/**
 * transform userId[] to accountId[] by find users and return user.ownerAccount
 * @param {mongoose.Schema.Types.ObjectId[]} userIds
 * @param {HookModels} models
 * @returns {mongoose.Schema.Types.ObjectId[]} accountIds
 */
const convertUserIdsToAccountIds = async (
  userIds: mongoose.Schema.Types.ObjectId[],
  models: HookModels
) => {
  const users = await models.userModel
    .find({
      _id: {
        $in: userIds
      }
    })
    .exec();
  return users.map(
    (user) => user.ownerAccount as unknown as mongoose.Schema.Types.ObjectId
  );
};

/**
 * get all follower of author to createContentItem with aggregator.createTime to now
 * @param {ContentDocument} doc
 * @param {HookModels}  models
 * @returns {ContentItemDocument[]}
 */
const createRelatedContentItem = async (
  doc: ContentDocument,
  models: HookModels
) => {
  //get all author follower
  const relationships = await models.relationshipModel
    .find({ followedUser: doc.author.id as any })
    .exec();
  const followerUserIds = relationships.map(
    (relation) => relation.user as unknown as mongoose.Schema.Types.ObjectId
  );
  const feedItemDtos = (
    await convertUserIdsToAccountIds(followerUserIds, models)
  ).map(
    (accountId) =>
      ({
        viewer: accountId,
        content: doc._id,
        called: false,
        seen: false,
        aggregator: {
          createTime: new Date(),
          following: true
        } as ContentAggregator,
        __v: 2 //add version
      } as FeedItemDto)
  );
  return models.feedItemModel.insertMany(feedItemDtos);
};

/**
 * Main logic of content.post('save) this will create revision document and create contentItems
 * @param doc
 * @param models
 * @returns
 */
export const postContentSave = async (
  doc: ContentDocument,
  models: HookModels
) => {
  const session = await models.revisionModel.startSession();

  session.withTransaction(async () => {
    //update revision
    const newRevison = new models.revisionModel({
      objectRef: {
        $ref: 'content',
        $id: mongoose.Types.ObjectId((doc as ContentDocument)._id)
      },
      payload: doc as Content
    });
    const result = await newRevison.save();
    //change all embed content from recast/quotecast

    if ((doc as ContentDocument).visibility != EntityVisibility.Publish) {
      //if this is quote cast
    }
  });
  session.endSession();
  //create contentItem
  //if is new and
  if (doc.wasNew && doc.visibility === EntityVisibility.Publish) {
    console.debug('saving doc -->', JSON.stringify(doc));
    await createRelatedContentItem(doc, models);
  }

  return true;
};

/**
 * before save a Content Document set document visibility default to publish and default engagement of like,recast,comment,quote to 0
 * @param doc
 * @returns
 */
export const preContentSave = async (doc: ContentDocument) => {
  console.debug('preSaveDoc', doc);
  doc.wasNew = doc.isNew;
  doc.visibility = doc.visibility ? doc.visibility : EntityVisibility.Publish;
  doc.revisionCount = doc.revisionCount ? doc.revisionCount + 1 : 1;
  if (!doc.engagements) {
    doc.engagements = {
      like: {
        count: 0,
        refs: []
      },
      comment: {
        count: 0,
        refs: []
      },
      recast: {
        count: 0,
        refs: []
      },
      quote: {
        count: 0,
        refs: []
      }
    };
  }
  return doc;
};
