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
import { TwilioChannel } from '@castcle-api/utils/clients';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import * as mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
import { OtpObjective } from '../models';
import { Account } from './account.schema';
import { CastcleBase } from './base.schema';

@Schema({ timestamps: true })
class OtpDocument extends CastcleBase {
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

  @Prop({ default: [] })
  sentAt: Date[];

  @Prop({ default: 0 })
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
  receiver: string;

  @Prop()
  completedAt?: Date;
}

export class Otp extends OtpDocument {
  exceededMaxRetries: () => boolean;
  exceededUsageLimit: () => boolean;
  failedToVerify: () => this;
  isValid: () => boolean;
  isValidVerifyMobileOtp: () => boolean;
  markCompleted: () => this;
  markVerified: () => this;
  regenerate: () => this;
}

export const OtpSchema = SchemaFactory.createForClass<OtpDocument, Otp>(
  OtpDocument,
);

export interface OtpModel extends mongoose.Model<Otp> {
  /**
   *  generate random refCode, check if it exist keep generating until found not exist one
   * @param {mongoose.Schema.Types.ObjectId} accountId
   * @param {OtpObjective} objective
   * @returns {Promise<Otp>}
   */
  generate(
    accountId: any,
    objective: OtpObjective,
    requestId: string,
    channel: TwilioChannel,
    verified: boolean,
    receiver: string,
    sid?: string,
  ): Promise<Otp>;
}

OtpSchema.statics.generate = async function (
  accountId: any,
  objective: OtpObjective,
  requestId: string,
  channel: TwilioChannel,
  verified: boolean,
  receiver: string,
  sid?: string,
) {
  let refCodeExists: boolean;
  const otp = new this({
    account: accountId,
    action: objective,
    requestId,
    retry: 0,
    channel,
    isVerify: verified,
    sid,
    receiver,
    sentAt: [new Date()],
  });

  do {
    otp.regenerate();
    refCodeExists = await this.findOne({
      account: accountId,
      action: objective,
      refCode: otp.refCode,
      completedAt: { $exists: false },
    }).exec();
  } while (refCodeExists);

  return otp.save();
};

OtpSchema.methods.exceededMaxRetries = function () {
  return this.retry > Environment.OTP_MAX_RETRIES;
};

OtpSchema.methods.exceededUsageLimit = function () {
  const maxUsage =
    this.channel === TwilioChannel.EMAIL
      ? Environment.OTP_EMAIL_MAX_USAGE
      : Environment.OTP_PHONE_MAX_USAGE;
  const hours =
    this.channel === TwilioChannel.EMAIL
      ? Environment.OTP_EMAIL_MAX_USAGE_HOURS
      : Environment.OTP_PHONE_MAX_USAGE_HOURS;
  const sendAfter = DateTime.now().minus({ hours }).toJSDate();
  const sending = this.sentAt.filter((sentAt) => sentAt >= sendAfter);
  return sending.length > maxUsage;
};

OtpSchema.methods.failedToVerify = function () {
  this.retry += 1;
  if (this.exceededMaxRetries()) this.isVerify = false;
  return this;
};

OtpSchema.methods.isValid = function () {
  return this.expireDate >= new Date();
};

OtpSchema.methods.isValidVerifyMobileOtp = function () {
  return (
    this.action === OtpObjective.VERIFY_MOBILE &&
    this.isValid() &&
    this.isVerify
  );
};

OtpSchema.methods.markCompleted = function () {
  this.completedAt = new Date();
  return this;
};

OtpSchema.methods.markVerified = function () {
  this.isVerify = true;
  return this.regenerate();
};

OtpSchema.methods.regenerate = function () {
  this.refCode = customAlphabet('1234567890')(Environment.OTP_DIGITS);
  this.expireDate = DateTime.now()
    .plus({
      minutes:
        this.channel === TwilioChannel.EMAIL
          ? Environment.OTP_EMAIL_EXPIRES_IN
          : Environment.OTP_PHONE_EXPIRES_IN,
    })
    .toJSDate();

  return this;
};
