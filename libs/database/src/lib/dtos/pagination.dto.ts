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

import { TransformStringToArrayOfStrings } from '@castcle-api/utils/commons';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  Max,
} from 'class-validator';
import { DEFAULT_QUERY_OPTIONS } from './common.dto';

export enum UserField {
  Relationships = 'relationships',
}

export enum ExcludeFeedField {
  Suggestion = 'suggestion',
  Ads = 'ads',
  Reminder = 'reminder',
}

export class ExpansionQuery {
  @ApiProperty({
    enum: UserField,
    required: false,
    isArray: true,
  })
  @TransformStringToArrayOfStrings()
  @IsOptional()
  @IsArray()
  @IsEnum(UserField, { each: true })
  userFields?: UserField[];

  hasRelationshipExpansion = (() => {
    return Boolean(this.userFields?.includes(UserField.Relationships));
  }) as unknown as boolean;
}

export class PaginationQuery extends ExpansionQuery {
  @ApiProperty({
    type: Number,
    maximum: 1000,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Max(1000)
  maxResults? = DEFAULT_QUERY_OPTIONS.limit;

  @ApiProperty({
    type: String,
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  sinceId?: string;

  @ApiProperty({
    type: String,
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  untilId?: string;
}

export class FeedQuery extends PaginationQuery {
  @IsOptional()
  mode?: 'current' | 'history';
  @IsOptional()
  hashtag?: string;
  @IsOptional()
  @TransformStringToArrayOfStrings()
  @IsEnum(ExcludeFeedField, { each: true })
  exclude: ExcludeFeedField[];
}
