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
import { Document } from 'mongoose';
import { CastcleIncludes } from './content.dto';

export class Meta {
  oldestId?: string;
  newestId?: string;
  resultCount: number;
  resultTotal?: number;

  static fromDocuments = (
    documents: Document[],
    resultTotal?: number
  ): Meta => {
    return {
      oldestId: documents[documents.length - 1]?.id,
      newestId: documents[0]?.id,
      resultCount: documents.length,
      resultTotal,
    };
  };
}

export class ResponseDto<T = any> {
  @ApiProperty()
  payload: T;

  @ApiProperty()
  includes?: CastcleIncludes;

  @ApiProperty()
  meta?: Meta;

  static ok = <U>({ includes, meta, payload }: ResponseDto<U>) => {
    const responseDto = new ResponseDto<U>();

    responseDto.payload = payload;
    responseDto.includes ??= includes;
    responseDto.meta ??= meta;

    return responseDto;
  };
}
