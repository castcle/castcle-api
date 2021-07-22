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
import { Document } from 'mongoose';
import { Account } from "../schemas/account.schema"

export type CredentialDocument = Credential & Document


@Schema({ timestamps:true })
export class Credential{

    @Prop({required: true , type: mongoose.Schema.Types.ObjectId, ref:'Account'})
    account:Account

    @Prop({required:true})
    accessToken:string

    @Prop({required:true})
    refreshToken:string

    @Prop({required:true})
    accessTokenExpireDate:Date;

    @Prop({required:true})
    refreshTokenExpireDate:Date;

    @Prop({required:true})
    platform:string

    @Prop({required:true})
    deviceUUID:string

    @Prop({required:true})
    device:string

    @Prop() 
    createdAt?:Date

    @Prop()
    updateAt?:Date

    isAccessTokenValid :Function

    isRefreshTokenValid :Function
    
}

export const CredentialSchema = SchemaFactory.createForClass(Credential);

CredentialSchema.methods.isAccessTokenValid = () => true
CredentialSchema.methods.isRefreshTokenValid = () => true