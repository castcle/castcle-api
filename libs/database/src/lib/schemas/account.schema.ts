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
import { SchemaTypes, Types } from 'mongoose';
import {
  AcceptDatePDPA,
  AccountActivation,
  AccountActivationType,
  AccountAuthentications,
  AccountCampaigns,
  AccountDevice,
} from '../models';
import { CastcleBase } from './base.schema';

interface ICredential {
  _id: any;
  deviceUUID: string;
}

@Schema({ timestamps: true })
export class AccountDocument extends CastcleBase {
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

  @Prop({ type: Object })
  authentications: AccountAuthentications;

  @Prop({ select: false })
  campaigns?: AccountCampaigns;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Account',
    index: true,
  })
  referralBy?: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  referralCount: number;

  @Prop({ type: Array })
  activations: AccountActivation[];

  @Prop({ type: Array })
  devices: AccountDevice[];

  @Prop({ type: Object })
  pdpa?: AcceptDatePDPA;

  /**
   * TO DO !!! this is a hot fix for guests
   */
  @Prop({ Type: Array })
  seenContents?: string[];
}

export const AccountSchema = SchemaFactory.createForClass(AccountDocument);

export class Account extends AccountDocument {
  changePassword: (password: string, email?: string) => Promise<Account | null>;
  verifyPassword: (password: string) => boolean;
  createActivation: (type: AccountActivationType) => AccountActivation;
}
