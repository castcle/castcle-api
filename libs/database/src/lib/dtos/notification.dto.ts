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

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';
import { Account } from '../schemas';
import { CastcleImage, CastcleMeta } from './common.dto';
import { CastcleBase } from './../schemas/base.schema';
import { TransformStringToEnum } from '@castcle-api/utils/commons';
import { PaginationQuery } from './pagination.dto';

export enum NotificationType {
  Like = 'like',
  Comment = 'comment',
  Quote = 'quote',
  Recast = 'recast',
  Tag = 'tag',
  Farm = 'farm',
  Reply = 'reply',
  System = 'system',
  AdsApprove = 'ad-approve',
  AdsDecline = 'ad-decline',
  Follow = 'follow',
}

export enum NotificationSource {
  Profile = 'profile',
  Page = 'page',
  System = 'system',
}

export enum NotificationRef {
  Comment = 'comment',
  Content = 'content',
}
export enum AndroidMessagePriority {
  NORMAL = 'normal',
  HIGH = 'high',
}

export class NotificationPayloadDto extends CastcleBase {
  @ApiProperty()
  id: string;

  @ApiProperty()
  notifyId?: string;

  @ApiProperty()
  avatar?: CastcleImage;

  @ApiProperty()
  message: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  contentId?: Types.ObjectId;

  @ApiProperty()
  commentId?: Types.ObjectId;

  @ApiProperty()
  replyId?: Types.ObjectId;

  @ApiProperty()
  advertiseId?: Types.ObjectId;

  @ApiProperty()
  profileId?: Types.ObjectId;

  @ApiProperty()
  systemId?: Types.ObjectId;

  @ApiProperty()
  read: boolean;
}

export class NotificationResponse {
  @ApiProperty({ type: NotificationPayloadDto, isArray: true })
  payload: NotificationPayloadDto[];

  @ApiProperty()
  meta: CastcleMeta;
}

export class NotificationQuery extends PaginationQuery {
  @TransformStringToEnum(NotificationSource)
  @IsString()
  @IsOptional()
  source?: NotificationSource;
}

export const DEFAULT_NOTIFICATION_QUERY_OPTIONS = {
  maxResults: 25,
} as NotificationQuery;

export interface CreateNotification {
  source: NotificationSource;
  account: Account;
  type: NotificationType;
  sourceUserId?: Types.ObjectId;
  contentRef?: Types.ObjectId;
  profileRef?: Types.ObjectId;
  commentRef?: Types.ObjectId;
  replyRef?: Types.ObjectId;
  read?: boolean;
}

export class RegisterTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceUUID: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firebaseToken: string;
}

export class NotificationBadgesPayloadDto {
  @ApiProperty()
  badges: string;
}
export class NotificationBadgesResponse {
  @ApiProperty({ type: NotificationBadgesPayloadDto, isArray: false })
  payload: NotificationBadgesPayloadDto;
}
