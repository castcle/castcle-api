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
import { TransformStringToKeyword } from '@castcle-api/utils/commons';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { KeywordType } from '../models';
import { PaginationQuery } from './pagination.dto';
import { GetUserParam } from './user.dto';
export class GetKeywordQuery extends PaginationQuery {
  @IsNotEmpty()
  @TransformStringToKeyword()
  keyword: {
    input: string;
    type: KeywordType;
  };
}

export enum QRCodeImageSize {
  Thumbnail = 'thumbnail',
  Medium = 'medium',
  Large = 'large',
}
export class GetChianDto extends GetUserParam {
  @IsNotEmpty()
  @IsString()
  chainId: string;
}

export class GetSizeDto {
  @IsOptional()
  @IsString()
  @IsEnum(QRCodeImageSize)
  size: string;
}

export class GetSyncSocialParam extends GetUserParam {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  syncSocialId: string;
}

export class GetDateDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(Environment.PDPA_ACCEPT_DATES)
  date: string;
}

export class UpdateEmailDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
