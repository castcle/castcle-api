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
import { CastcleImage, Pagination } from '.';
import { CommentType } from '../schemas/comment.schema';
import { UserVerified } from '../schemas/user.schema';
import { Author } from './content.dto';

export class CommentDto {
  author: any; //mongooseId
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

class Like {
  count: number;
  liked: boolean;
  participant: {
    type: 'people' | 'page'; // people or page
    id: string; //userId
    castcleId: string; // @castcle
    displayName: string;
  }[];
}

export class CommentPayload {
  @ApiProperty()
  id: string; //commentId
  @ApiProperty()
  message: string;
  @ApiProperty()
  like: Like;
  @ApiProperty()
  author: Author;
  @ApiProperty()
  reply: {
    id: string;
    message: string;
    createAt: string;
    author: Author;
    like: Like;
  }[];
  @ApiProperty()
  hasHistory: boolean;
  @ApiProperty()
  createAt: string;
  @ApiProperty()
  updateAt: string;
}

export class CommentsReponse {
  message: string;
  payload: CommentPayload[];
  pagination: Pagination;
}
