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
import { SchemaTypes } from 'mongoose';
import { WalletType } from '../models';
import { CastcleBase } from './base.schema';

@Schema({ id: false, _id: false, timestamps: false, versionKey: false })
export class MicroTransaction {
  @Prop({ index: true, ref: 'Account', type: SchemaTypes.ObjectId })
  account?: string;

  @Prop({ index: true, ref: 'User', type: SchemaTypes.ObjectId })
  user?: string;

  @Prop({ type: String })
  type: WalletType;

  @Prop({ type: SchemaTypes.Decimal128 })
  value?: number;
}

@Schema({ id: false, _id: false, timestamps: false, versionKey: false })
export class TItem {
  @Prop({ index: true })
  caccountNo: string;

  @Prop({ type: SchemaTypes.Decimal128 })
  value: number;
}

@Schema({ id: false, _id: false, timestamps: false, versionKey: false })
export class TLedger {
  @Prop({ type: Object })
  debit: TItem;

  @Prop({ type: Object })
  credit: TItem;
}

const MicroTransactionSchema = SchemaFactory.createForClass(MicroTransaction);

@Schema({ timestamps: true })
export class Transaction extends CastcleBase {
  @Prop({ type: MicroTransactionSchema, index: true })
  from?: MicroTransaction;

  @Prop({ type: [MicroTransactionSchema], index: true })
  to?: MicroTransaction[];

  @Prop({ type: Object })
  data?: any;

  @Prop({ type: Array })
  ledgers?: TLedger[];
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
