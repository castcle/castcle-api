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
import {
  NotificationPayloadDto,
  NotificationType,
} from '../dtos/notification.dto';
import { Account } from './account.schema';
import { CastcleBase } from './base.schema';
import { User } from './user.schema';

export type NotificationDocument = Notification & INotification;
@Schema({ timestamps: true })
export class Notification extends CastcleBase {
  @Prop()
  avatar: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  source: string;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  })
  sourceUserId: User;

  @Prop({ required: true, type: String })
  type: NotificationType;

  @Prop({ required: true, type: Object })
  targetRef: any;

  @Prop()
  read: boolean;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    index: true,
  })
  account: Account;
}

interface INotification extends Document {
  toNotificationPayload(): NotificationPayloadDto;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.methods.toNotificationPayload = function () {
  return {
    id: (this as NotificationDocument)._id,
    avatar: (this as NotificationDocument).avatar,
    message: (this as NotificationDocument).message,
    source: (this as NotificationDocument).source,
    type: (this as NotificationDocument).type,
    read: (this as NotificationDocument).read,
    content: {
      id:
        (this as NotificationDocument).type === NotificationType.Content ||
        (this as NotificationDocument).type === NotificationType.Like
          ? (this as NotificationDocument).targetRef.oid
          : null,
    },
    comment: {
      id:
        (this as NotificationDocument).type === NotificationType.Comment
          ? (this as NotificationDocument).targetRef.oid
          : null,
    },
    system: {
      id: null,
    },
  } as NotificationPayloadDto;
};
