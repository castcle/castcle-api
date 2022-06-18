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
import { AdsBidType, AdsPaymentMethod } from '../models';

/**
 * Detail should not change much once it created
 */
@Schema({ id: false, _id: false, timestamps: false, versionKey: false })
export class AdsDetail {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  code: string;

  @Prop({ required: true, type: SchemaTypes.Decimal128 })
  dailyBudget: number;

  @Prop({ required: true })
  duration: number;

  @Prop({ required: true, type: String })
  paymentMethod: AdsPaymentMethod;

  @Prop({ required: true, type: String })
  dailyBidType: AdsBidType;

  @Prop()
  dailyBidValue?: number;
}

export const AdsDetailSchema = SchemaFactory.createForClass(AdsDetail);
