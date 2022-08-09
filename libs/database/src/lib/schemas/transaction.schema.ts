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
import { TransactionStatus, TransactionType, WalletType } from '../models';
import { CastcleBase } from './base.schema';

export class AirdropTransactionData {
  campaign: Types.ObjectId;
  mobileCountryCode?: string;
  mobileNumber?: string;
}

export class ExternalTransactionData {
  address: string;
  chainId: string;
  memo: string;
  note: string;
}

export type TransactionData = AirdropTransactionData | ExternalTransactionData;

@Schema({ id: false, _id: false, timestamps: false, versionKey: false })
class TransactionDataEntity
  implements
    Required<AirdropTransactionData>,
    Required<ExternalTransactionData>
{
  @Prop({ index: true, ref: 'Campaign', type: SchemaTypes.ObjectId })
  campaign: Types.ObjectId;

  @Prop()
  mobileCountryCode: string;

  @Prop()
  mobileNumber: string;

  @Prop()
  address: string;

  @Prop()
  chainId: string;

  @Prop()
  memo: string;

  @Prop()
  note: string;
}

const TransactionDataSchema = SchemaFactory.createForClass(
  TransactionDataEntity,
);

@Schema({ id: false, _id: false, timestamps: false, versionKey: false })
export class MicroTransaction {
  @Prop({ index: true, ref: 'User', type: SchemaTypes.ObjectId })
  user?: Types.ObjectId;

  @Prop({ type: String })
  type: WalletType;

  @Prop({ type: SchemaTypes.Decimal128 })
  value: Types.Decimal128;
}

const MicroTransactionSchema = SchemaFactory.createForClass(MicroTransaction);

@Schema({ id: false, _id: false, timestamps: false, versionKey: false })
class TItem {
  @Prop({ index: true })
  cAccountNo: string;

  @Prop({ type: SchemaTypes.Decimal128 })
  value: Types.Decimal128 | number;
}

const TItemSchema = SchemaFactory.createForClass(TItem);

@Schema({ id: false, _id: false, timestamps: false, versionKey: false })
export class TLedger {
  @Prop({ type: TItemSchema })
  debit: TItem;

  @Prop({ type: TItemSchema })
  credit: TItem;
}

const TLedgerSchema = SchemaFactory.createForClass(TLedger);

@Schema({ timestamps: true })
export class Transaction extends CastcleBase {
  @Prop({ type: MicroTransactionSchema, index: true })
  from: MicroTransaction;

  @Prop({ type: [MicroTransactionSchema], index: true })
  to: MicroTransaction[];

  @Prop({ type: String })
  type: TransactionType;

  @Prop({ type: String, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Prop()
  failureMessage?: string;

  @Prop({ type: TransactionDataSchema })
  data?: TransactionData;

  @Prop({ type: [TLedgerSchema] })
  ledgers?: TLedger[];
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
