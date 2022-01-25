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
import { Password } from '@castcle-api/utils/commons';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model } from 'mongoose';
import { env } from '../environment';
import { Account } from './account.schema';
import { CastcleBase } from './base.schema';

export enum OtpObjective {
  ChangePassword = 'change_password',
  ForgotPassword = 'forgot_password',
  VerifyMobile = 'verify_mobile',
}

export type OtpDocument = Otp & IOtp;

@Schema({ timestamps: true })
export class Otp extends CastcleBase {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    index: true,
  })
  account: Account;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  refCode: string;

  @Prop({ required: true })
  expireDate: Date;

  @Prop()
  retry: number;

  @Prop()
  requestId: string;

  @Prop()
  channel: string;

  @Prop({ default: false })
  isVerify: boolean;

  @Prop()
  sid: string;

  @Prop()
  reciever: string;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

interface IOtp extends Document {
  isValid(): boolean;
}

export interface OtpModel extends Model<OtpDocument> {
  /**
   *  generate random refCode, check if it exist keep generating until found not exist one
   * @param {mongoose.Schema.Types.ObjectId} accountId
   * @param {OtpObjective} objective
   * @returns {Promise<OtpDocument>}
   */
  generate(
    accountId: any,
    objective: OtpObjective,
    requestId: string,
    channel: string,
    verify: boolean,
    reciever?: string,
    sid?: string
  ): Promise<OtpDocument>;
}

OtpSchema.statics.generate = async function (
  accountId: any,
  objective: OtpObjective,
  requestId: string,
  channel: string,
  verify: boolean,
  reciever?: string,
  sid?: string
) {
  let newRefCode: string;
  let otpFindingResult;
  do {
    newRefCode = Password.generateRandomDigits(env.OTP_DIGITS);
    otpFindingResult = await this.findOne({
      account: accountId,
      action: objective,
      refCode: newRefCode,
    }).exec();
  } while (otpFindingResult);
  const now = new Date();
  const otp = new this({
    account: accountId,
    action: objective,
    refCode: newRefCode,
    requestId: requestId,
    retry: 0,
    channel: channel,
    isVerify: verify,
    sid: sid,
    expireDate: new Date(now.getTime() + env.OPT_EXPIRES_IN * 1000),
    reciever: reciever,
  });
  return otp.save();
};

OtpSchema.methods.isValid = function () {
  const now = new Date().getTime();
  const expireDate = (this as OtpDocument).expireDate.getTime();
  return expireDate - now >= 0;
};
