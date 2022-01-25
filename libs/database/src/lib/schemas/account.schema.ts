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
import { Document } from 'mongoose';
import { CastcleBase } from './base.schema';
import { Password } from '@castcle-api/utils/commons';
export type AccountDocument = Account & IAccount;

export enum AccountRole {
  Member = 'member',
  Guest = 'guest',
}

interface ICredential {
  _id: any;
  deviceUUID: string;
}

@Schema({ timestamps: true })
export class Account extends CastcleBase {
  @Prop({
    index: true,
  })
  email: string;

  @Prop()
  password: string;

  @Prop()
  activateDate: Date;

  @Prop({ required: true })
  isGuest: boolean;

  @Prop({ required: true, type: Object })
  preferences: {
    languages: string[];
  };

  @Prop({ type: Array })
  seenContents: any[];

  @Prop({ type: Object })
  mobile: {
    countryCode: string;
    number: string;
  };

  @Prop({ type: Object })
  geolocation?: {
    countryCode: string;
    continentCode: string;
  };

  @Prop({ type: Array })
  credentials: ICredential[];
}
export const AccountSchema = SchemaFactory.createForClass(Account);

export interface IAccount extends Document {
  changePassword(
    pasword: string,
    email?: string
  ): Promise<AccountDocument | null>;
  verifyPassword(password: string): Promise<boolean>;
}

AccountSchema.methods.changePassword = async function (
  password: string,
  email?: string
) {
  const encryptPassword = await Password.create(password);
  if (encryptPassword) {
    (this as AccountDocument).password = encryptPassword;
    if (email) (this as AccountDocument).email = email;
    return this.save();
  } else return null;
};

AccountSchema.methods.verifyPassword = function (password: string) {
  return Password.verify(password, (this as AccountDocument).password);
};
