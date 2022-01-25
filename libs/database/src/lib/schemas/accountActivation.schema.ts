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

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { env } from '../environment';
import { Document, Model } from 'mongoose';
import { Account } from '../schemas/account.schema';
import { CastcleBase } from './base.schema';
import { EmailVerifyToken } from '../dtos/token.dto';
import { Token } from '@castcle-api/utils/commons';

export type AccountActivationDocument = AccountActivation & IAccountActivation;

export enum AccountActivationType {
  Email = 'email',
  Mobile = 'mobile',
}

@Schema({ timestamps: true })
export class AccountActivation extends CastcleBase {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    index: true,
  })
  account: Account;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  verifyToken: string;

  @Prop({ required: true })
  verifyTokenExpireDate: Date;

  @Prop()
  activationDate: Date;

  @Prop()
  revocationDate: Date;
}

export const AccountActivationSchema =
  SchemaFactory.createForClass(AccountActivation);

export interface IAccountActivation extends Document {
  isVerifyTokenValid(): boolean;
}

AccountActivationSchema.methods.isVerifyTokenValid = function () {
  return Token.isTokenValid(
    (this as AccountActivationDocument).verifyToken,
    env.JWT_VERIFY_SECRET
  );
};

export interface AccountActivationModel
  extends Model<AccountActivationDocument> {
  generateVerifyToken(payload: EmailVerifyToken): {
    verifyToken: string;
    verifyTokenExpireDate: Date;
  };
}

AccountActivationSchema.statics.generateVerifyToken = function (
  payload: EmailVerifyToken
) {
  const now = new Date();
  const verifyTokenExpireDate = new Date(
    now.getTime() + Number(env.JWT_VERIFY_EXPIRES_IN) * 1000
  );
  payload.verifyTokenExpiresTime = verifyTokenExpireDate.toISOString();
  const verifyToken = Token.generateToken(
    payload,
    env.JWT_VERIFY_SECRET,
    Number(env.JWT_VERIFY_EXPIRES_IN)
  );
  return {
    verifyToken,
    verifyTokenExpireDate,
  };
};
