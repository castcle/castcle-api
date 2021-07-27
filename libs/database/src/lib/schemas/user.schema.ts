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
import { Account } from '../schemas/account.schema';
import { TimestampBase } from './base.timestamp.schema';

export type UserDocument = User & Document

export interface UserProfile{
  birthdate:string
  overview:string
  works:string[]
  educations:string[]
  homeTowns:string[]
  websites:{
      website:string
      detail:string
  }[]
  socials:{
      facebook:string
      twitter:string
      youtube:string
      medium:string
  }
  details:string
}

export enum UserType { People = 'people', Page ='page'}

@Schema({ timestamps:true })
export class User extends TimestampBase{

  @Prop({required: true , type: mongoose.Schema.Types.ObjectId, ref:'Account'})
  ownerAccount:Account

  @Prop({required:true})
  displayName:string

  @Prop({required:true})
  displayId:string

  @Prop({type: Object})
  profile:UserProfile

  @Prop({required:true})
  type:string

  @Prop()
  verified:boolean

}

export const UserSchema = SchemaFactory.createForClass(User);