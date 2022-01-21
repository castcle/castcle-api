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
import { Token } from '@castcle-api/utils/commons';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document } from 'mongoose';
import { EntityVisibility } from '../dtos/common.dto';
import {
  AccessTokenPayload,
  MemberAccessTokenPayload,
  RefreshTokenPayload,
} from '../dtos/token.dto';
import { env } from '../environment';
import { Account } from '../schemas/account.schema';
import { CastcleBase } from './base.schema';

export type CredentialDocument = Credential & ICredential;

@Schema({ timestamps: true })
export class Credential extends CastcleBase {
  @Prop({
    required: true,
    type: Object,
  })
  account: Account;

  @Prop({ required: true, index: true })
  accessToken: string;

  @Prop({ required: true, unique: true })
  refreshToken: string;

  @Prop({ required: true })
  accessTokenExpireDate: Date;

  @Prop({ required: true })
  refreshTokenExpireDate: Date;

  @Prop({ required: true })
  platform: string;

  @Prop({ required: true })
  deviceUUID: string;

  @Prop({ required: true })
  device: string;

  @Prop()
  firebaseNotificationToken?: string;
}

export const CredentialSchema = SchemaFactory.createForClass(Credential);

export interface CredentialModel extends mongoose.Model<CredentialDocument> {
  generateAccessToken(payload: AccessTokenPayload | MemberAccessTokenPayload): {
    accessToken: string;
    accessTokenExpireDate: Date;
  };
  generateRefreshToken(payload: RefreshTokenPayload): {
    refreshToken: string;
    refreshTokenExpireDate: Date;
  };
}

CredentialSchema.statics.generateAccessToken = (
  payload: AccessTokenPayload | MemberAccessTokenPayload
) => {
  const now = new Date();
  const accessTokenExpireDate = new Date(
    now.getTime() + Number(env.JWT_ACCESS_EXPIRES_IN) * 1000
  );
  payload.accessTokenExpiresTime = accessTokenExpireDate.toISOString();
  const accessToken = Token.generateToken(
    payload,
    env.JWT_ACCESS_SECRET,
    Number(env.JWT_ACCESS_EXPIRES_IN)
  );
  return {
    accessToken,
    accessTokenExpireDate,
  };
};
CredentialSchema.statics.generateRefreshToken = (
  payload: RefreshTokenPayload
) => {
  const now = new Date();
  const refreshTokenExpireDate = new Date(
    now.getTime() + Number(env.JWT_REFRESH_EXPIRES_IN) * 1000
  );
  payload.refreshTokenExpiresTime = refreshTokenExpireDate.toISOString();
  const refreshToken = Token.generateToken(
    payload,
    env.JWT_REFRESH_SECRET,
    Number(env.JWT_REFRESH_EXPIRES_IN)
  );

  return {
    refreshToken,
    refreshTokenExpireDate,
  };
};

export interface ICredential extends Document {
  renewTokens(
    accessTokenPayload: AccessTokenPayload | MemberAccessTokenPayload,
    refreshTokenPayload: RefreshTokenPayload
  ): Promise<{ accessToken: string; refreshToken: string }>;
  renewAccessToken(
    payload: AccessTokenPayload | MemberAccessTokenPayload
  ): Promise<string>;
  isAccessTokenValid(): boolean;
  isRefreshTokenValid(): boolean;
}

CredentialSchema.methods.renewTokens = async function (
  accessTokenPayload: AccessTokenPayload | MemberAccessTokenPayload,
  refreshTokenPayload: RefreshTokenPayload
) {
  const credentialModel = mongoose.model(
    'Credential',
    CredentialSchema
  ) as unknown as CredentialModel;
  const refreshTokenResult =
    credentialModel.generateRefreshToken(refreshTokenPayload);
  const accessTokenResult =
    credentialModel.generateAccessToken(accessTokenPayload);
  (this as CredentialDocument).accessToken = accessTokenResult.accessToken;
  (this as CredentialDocument).accessTokenExpireDate =
    accessTokenResult.accessTokenExpireDate;
  (this as CredentialDocument).refreshToken = refreshTokenResult.refreshToken;
  (this as CredentialDocument).refreshTokenExpireDate =
    refreshTokenResult.refreshTokenExpireDate;
  await this.save();
  return {
    accessToken: accessTokenResult.accessToken,
    refreshToken: refreshTokenResult.refreshToken,
  };
};

CredentialSchema.methods.renewAccessToken = async function (
  payload: AccessTokenPayload | MemberAccessTokenPayload
) {
  const credentialModel = mongoose.model(
    'Credential',
    CredentialSchema
  ) as unknown as CredentialModel;
  const result = credentialModel.generateAccessToken(payload);
  (this as CredentialDocument).accessToken = result.accessToken;
  (this as CredentialDocument).accessTokenExpireDate =
    result.accessTokenExpireDate;
  await this.save();
  return result.accessToken;
};

CredentialSchema.methods.isAccessTokenValid = function () {
  const { account, accessToken } = this as CredentialDocument;

  if (account.visibility !== EntityVisibility.Publish) return false;

  return Token.isTokenValid(accessToken, env.JWT_ACCESS_SECRET);
};

CredentialSchema.methods.isRefreshTokenValid = function () {
  const { account, refreshToken } = this as CredentialDocument;

  if (account.visibility !== EntityVisibility.Publish) return false;

  return Token.isTokenValid(refreshToken, env.JWT_REFRESH_SECRET);
};

export const CredentialSchemaFactory = (): mongoose.Schema<any> => {
  return CredentialSchema;
};
