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
import { Pagination } from '.';
import { CommentType } from '../schemas/comment.schema';

export class CommentDto {
  user: any; //mongooseId
  message: string;
  type: CommentType;
  targetRef: {
    $id: any;
    $ref: string;
  };
}

export class UpdateCommentDto {
  message: string;
}

export class CommentPayload {
  @ApiProperty()
  id: string; //commentId
  @ApiProperty()
  message: string;
  @ApiProperty()
  like: {
    count: number;
    liked: boolean;
    participant: {
      type: 'people' | 'page'; // people or page
      id: string; //userId
      castcleId: string; // @castcle
      displayName: string;
    }[];
  };
  @ApiProperty()
  author: {
    type: 'people' | 'page'; // people or page
    id: string;
    castcleId: string; // @castcle
    displayName: string;
    avatar: string;
    verified: boolean;
    followed: boolean;
  };
  @ApiProperty()
  reply: {
    id: string;
    message: string;
    created: string;
  }[];
  @ApiProperty()
  hasHistory: boolean;
  @ApiProperty()
  created: string;
  @ApiProperty()
  updated: string;
}

export class CommentsReponse {
  message: string;
  payload: CommentPayload[];
  pagination: Pagination;
}
