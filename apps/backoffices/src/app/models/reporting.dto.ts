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
  Content,
  ReportingStatus,
  ReportingType,
  User,
} from '@castcle-api/database';
import { TransformStringToArrayOfStrings } from '@castcle-api/utils/commons';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class GetReportingQuery {
  @IsOptional()
  @IsEnum(ReportingType, { each: true })
  @TransformStringToArrayOfStrings()
  type?: string[];

  @IsOptional()
  @IsEnum(ReportingStatus, { each: true })
  @TransformStringToArrayOfStrings()
  status?: string[];
}

class ReportingPayload {
  id: string;
  reportBy: string[];
  status: string;
  type: string;
  user: string;
  createdAt: Date;
  updatedAt: Date;
}

class ReportedBy {
  id: string;
  message: string;
  user: User;
  subject: {
    slug: string;
    name: string;
  };
  payload: Content | User;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export class GetReportingResponse {
  reportings: ReportingPayload[];
  reportedBy: ReportedBy[];
}

export class UpdateIllegal {
  @IsMongoId()
  @IsNotEmpty()
  id: string;

  @IsEnum(ReportingType)
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  subjectByAdmin?: string;
}
