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
import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { CommentPayload } from './comment.dto';
import { Author, IncludeUser } from './content.dto';
import { GetUserParam } from './user.dto';

export class CommentIncludes {
  users: IncludeUser[];
  comments?: CommentPayload[];

  constructor({ comments, users }: CommentIncludes) {
    this.comments = comments;
    this.users = CommentIncludes.filterAuthors(users);
  }

  static filterAuthors(rawAuthors: IncludeUser[]) {
    const authors: Author[] = [];

    rawAuthors.forEach((author) => {
      const authorIndex = authors.findIndex(
        ({ id }) => String(author.id) == String(id),
      );

      if (authorIndex >= 0) return;

      authors.push(author);
    });

    return authors;
  }
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  message: string;
  @ApiProperty()
  @IsString()
  contentId: string;
}
export class CommentParam extends GetUserParam {
  @IsMongoId()
  @ApiProperty()
  sourceCommentId: string;
}

export class ReplyCommentParam extends CommentParam {
  @IsMongoId()
  @ApiProperty()
  replyCommentId: string;
}

export class CommentResponse {
  @ApiProperty()
  payload: CommentPayload;
  @ApiProperty()
  includes: CommentIncludes;
}

export class UnlikeCommentCastParam extends GetUserParam {
  @IsString()
  @IsNotEmpty()
  sourceCommentId: string;
}
