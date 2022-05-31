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

import {
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { GetUserParam } from './user.dto';
import { IsNotEmpty } from 'class-validator';
import { Content, Engagement, User } from '../schemas';
import {
  BlogPayload,
  ContentType,
  ImagePayload,
  ShortPayload,
} from './content.dto';
import { UserType } from '../models';
import {
  TransformSortStringToSortObject,
  TransformStringToArrayOfStrings,
} from '@castcle-api/utils/commons';
import { PaginationQuery } from './pagination.dto';

export class ResponseParticipate {
  user: {
    id: string;
    castcleId: string;
    displayName: string;
    type: UserType;
  };

  participate: {
    liked: boolean;
    commented: boolean;
    quoted: boolean;
    recasted: boolean;
    reported: boolean;
  };
}
export class GetContentCastDto {
  contents: Content[];
  casts?: Content[];
  authors?: User[];
  engagements?: Engagement[];
  metrics?: any[];
  engagementsOriginal?: Engagement[];
  metricsOriginal?: any[];
}

export class GetContentDto {
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  contentId: string;
}

export class LikeCommentDto {
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  commentId: string;
}

export class GetSourceContentParam extends GetUserParam {
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  sourceContentId: string;
}
export class QuoteCastDto extends GetContentDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class CreateContentDto {
  @IsString()
  @IsNotEmpty()
  type: ContentType;

  @IsNotEmpty()
  payload: ShortPayload | BlogPayload | ImagePayload;

  @IsString()
  @IsNotEmpty()
  castcleId: string;
}

export class GetContentQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(ContentType, { each: true })
  @TransformStringToArrayOfStrings()
  type?: string;

  @IsOptional()
  @IsObject()
  @TransformSortStringToSortObject()
  sortBy?: string;
}

export class GetFollowQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(UserType, { each: true })
  @TransformStringToArrayOfStrings()
  type?: string[];

  @IsOptional()
  @IsObject()
  @TransformSortStringToSortObject()
  sort?: string;
}
