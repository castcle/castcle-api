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
import { IsOptional } from 'class-validator';

export class UxEngagementBody {
  @ApiProperty()
  @IsOptional()
  platform: string;

  @ApiProperty()
  @IsOptional()
  client: string;

  @ApiProperty()
  @IsOptional()
  accountId: string;

  @ApiProperty()
  @IsOptional()
  uxSessionId: string;

  @ApiProperty()
  @IsOptional()
  screenId: string;

  @ApiProperty()
  @IsOptional()
  screenInstance: any;

  @ApiProperty()
  @IsOptional()
  feedItemId: string;

  @ApiProperty()
  @IsOptional()
  target: string;

  @ApiProperty()
  @IsOptional()
  targetId: string;

  @ApiProperty()
  @IsOptional()
  eventType: string;

  @ApiProperty()
  @IsOptional()
  eventData: any;

  @ApiProperty()
  @IsOptional()
  timestamp: string;
}

export class UxEngagementDto {
  platform: string;
  client: string;
  account: any; //will be accountId
  screenId: string;
  screenInstance: any;
  feedItemId: string;
  target: string;
  targetId: string;
  eventType: string;
  eventData: any;
  timestamp: Date;
}
