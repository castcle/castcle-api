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
import {
  AccountDocument,
  CredentialDocument,
  UserDocument,
  UserType,
} from '../schemas';

type HookModels = {
  credentialModel: Model<CredentialDocument>;
  userModel: Model<UserDocument>;
};

/**
 * If Account has not set the visibility set publish as default
 * @param {AccountDocument} doc
 * @returns {AccountDocument}
 */
export const preAccountSave = (doc: AccountDocument) => {
  if (!doc.visibility) doc.visibility = EntityVisibility.Publish;
  return doc;
};
/**
 * Update activate status of user to be activated = true and update embed status in credential
 * @param doc
 * @param models
 * @returns {Promise<boolean>}
 */
export const postAccountSave = async (
  doc: AccountDocument,
  models: HookModels
) => {
  try {
    if (doc.activateDate)
      await models.userModel
        .updateOne(
          { ownerAccount: doc._id, type: UserType.People },
          { 'verified.email': true }
        )
        .exec();
    await models.credentialModel
      .updateMany(
        { 'account._id': doc._id },
        {
          'account.isGuest': doc.isGuest,
          'account.activateDate': doc.activateDate,
          'account.visibility': doc.visibility,
          'account.preferences': doc.preferences,
          'account.email': doc.email,
          'account.geolocation': doc.geolocation ? doc.geolocation : null,
        }
      )
      .exec();
    return true;
  } catch (error) {
    return false;
  }
};
