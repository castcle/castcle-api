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

import { CastcleImage } from '@castcle-api/utils/aws';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { GetAccountParam } from './account.dto';

export class GetShortcutParam extends GetAccountParam {
  @IsMongoId()
  @IsNotEmpty()
  shortcutId: string;
}
export class ShortcutInternalDto {
  @IsString()
  @IsNotEmpty()
  chainId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}
export class ShortcutSort {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @IsNotEmpty()
  order: number;
}
export class ShortcutSortDto {
  @Type(() => ShortcutSort)
  @ValidateNested({ each: true })
  @IsArray()
  @ArrayMinSize(1)
  payload: ShortcutSort[];
}
export class WalletShortcutOptions {
  id?: string;
  chainId?: string;
  order?: string;
}
export class WalletShortcutResponse {
  id: string;
  chainId: string;
  userId: string;
  type: string;
  castcleId: string;
  displayName: string;
  images: CastcleImage;
  order: number;
  createdAt: string;
  updatedAt: string;
  memo?: string;
}