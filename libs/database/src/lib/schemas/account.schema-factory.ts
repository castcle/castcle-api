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

import { Environment } from '@castcle-api/environments';
import { Password, Token } from '@castcle-api/utils/commons';
import { Model } from 'mongoose';
import { EntityVisibility } from '../dtos';
import { AccountActivationType, UserType } from '../models';
import { AccountSchema } from './account.schema';
import { Credential } from './credential.schema';
import { User } from './user.schema';

export const AccountSchemaFactory = (
  credentialModel: Model<Credential>,
  userModel: Model<User>,
) => {
  AccountSchema.pre('save', function (next) {
    if (!this.visibility) this.visibility = EntityVisibility.Publish;

    next();
  });

  AccountSchema.post('save', async function (doc, next) {
    try {
      if (doc.activateDate) {
        await userModel.updateOne(
          { ownerAccount: doc._id, type: UserType.PEOPLE },
          { 'verified.email': true },
        );
      }

      await credentialModel.updateMany(
        { 'account._id': doc._id },
        {
          'account.isGuest': doc.isGuest,
          'account.activateDate': doc.activateDate,
          'account.visibility': doc.visibility,
          'account.preferences': doc.preferences,
          'account.email': doc.email,
          'account.geolocation': doc.geolocation || null,
        },
      );
    } catch (error) {
      console.error(error);
    }

    next();
  });

  AccountSchema.methods.changePassword = function (
    password: string,
    email?: string,
  ) {
    const encryptPassword = Password.hash(password);
    if (!encryptPassword) return null;

    this.password = encryptPassword;
    if (email) this.email = email;
    return this.save();
  };

  AccountSchema.methods.verifyPassword = function (password: string) {
    return Password.verify(password, this.password || '');
  };

  AccountSchema.methods.createActivation = function (
    type: AccountActivationType,
  ) {
    const verifyTokenExpireDate = new Date(
      Date.now() + Environment.JWT_VERIFY_EXPIRES_IN * 1000,
    );
    const activation = {
      type,
      verifyTokenExpireDate,
      verifyToken: Token.generateToken(
        {
          id: this._id,
          verifyTokenExpiresTime: verifyTokenExpireDate.toISOString(),
        },
        Environment.JWT_VERIFY_SECRET,
        Environment.JWT_VERIFY_EXPIRES_IN,
      ),
    };
    (this.activations ||= []).push(activation);
    return activation;
  };

  return AccountSchema;
};
